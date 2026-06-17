<?php
/**
 * Woordkast — server-side Claude proxy.
 *
 * Lives on Hostinger next to the built app (e.g. /public_html/mydutchwords/api.php)
 * so the browser never sees the Anthropic API key. The frontend POSTs
 * { "action": "lookup" | "exercise", "word": "..." } and gets JSON back.
 *
 * The key is read, in order, from:
 *   1. the ANTHROPIC_API_KEY environment variable,
 *   2. a sibling config.local.php that returns the key, or
 *   3. config.local.php in the PARENT folder (recommended on Hostinger: deploys
 *      overwrite this app folder but never its parent, so the key survives).
 * See config.example.php for the file format.
 */

header('Content-Type: application/json; charset=utf-8');
// Same-origin only: do NOT send Access-Control-Allow-Origin. The app is served
// from the same host as this file, so it doesn't need CORS — and omitting it
// stops other sites from spending your API budget.

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_WORD_LEN = 60;

function fail(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}

function resolve_key(): string {
    $env = getenv('ANTHROPIC_API_KEY');
    if (is_string($env) && $env !== '') {
        return $env;
    }
    foreach ([__DIR__ . '/config.local.php', dirname(__DIR__) . '/config.local.php'] as $config) {
        if (is_file($config)) {
            $key = require $config;
            if (is_string($key) && $key !== '') {
                return $key;
            }
        }
    }
    return '';
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    // A plain GET acts as a health check.
    echo json_encode(['ok' => true, 'configured' => resolve_key() !== '']);
    exit;
}

$apiKey = resolve_key();
if ($apiKey === '') {
    fail(503, 'AI backend is not configured yet.');
}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) {
    fail(400, 'Invalid request body.');
}

$action = $body['action'] ?? '';
$word = trim((string) ($body['word'] ?? ''));

if ($word === '' || mb_strlen($word) > MAX_WORD_LEN) {
    fail(400, 'Missing or invalid word.');
}
if ($action !== 'lookup' && $action !== 'exercise') {
    fail(400, 'Unknown action.');
}

if ($action === 'lookup') {
    $prompt = "You are a Dutch-English dictionary for a language learner.\n"
        . "For the Dutch word \"$word\", respond with ONLY a JSON object, no prose, no code fences:\n"
        . '{"translation":"<concise English translation>","gender":"<de|het|none>","example_sentence":"<one natural Dutch sentence that uses the word verbatim>"}' . "\n"
        . "Use \"de\" or \"het\" for nouns and \"none\" for non-nouns. The example_sentence MUST contain the exact word \"$word\".";
} else {
    $prompt = "You write fill-in-the-blank practice sentences for a Dutch learner.\n"
        . "Write ONE natural, meaningful Dutch sentence that uses the word \"$word\" exactly once, verbatim, in a context that makes its meaning clear.\n"
        . "Keep it short (max ~12 words). Respond with ONLY a JSON object, no prose, no code fences:\n"
        . '{"sentence":"<the Dutch sentence containing the word verbatim>"}';
}

$payload = json_encode([
    'model' => MODEL,
    'max_tokens' => 200,
    'messages' => [['role' => 'user', 'content' => $prompt]],
]);

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => [
        'content-type: application/json',
        'x-api-key: ' . $apiKey,
        'anthropic-version: 2023-06-01',
    ],
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($response === false) {
    fail(502, 'Upstream request failed: ' . $curlErr);
}
if ($httpCode < 200 || $httpCode >= 300) {
    fail(502, 'Upstream error ' . $httpCode);
}

$data = json_decode($response, true);
$text = '';
if (isset($data['content']) && is_array($data['content'])) {
    foreach ($data['content'] as $block) {
        if (($block['type'] ?? '') === 'text') {
            $text .= $block['text'] ?? '';
        }
    }
}

// Strip any stray code fences, then re-emit the model's JSON to the client.
$text = trim($text);
$text = preg_replace('/^```(?:json)?/i', '', $text);
$text = preg_replace('/```$/', '', trim($text));
$parsed = json_decode(trim($text), true);

if (!is_array($parsed)) {
    fail(502, 'Could not parse AI response.');
}

echo json_encode($parsed);
