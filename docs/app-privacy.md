# App privacy: store labels and the iOS privacy manifest

What Woordkast collects, written up for **App Store Connect → App Privacy**
and the **Google Play Data safety** form, plus the `PrivacyInfo.xcprivacy`
file the iOS shell needs. The user-facing version is
[`public/privacy.html`](../public/privacy.html). Keep all three in step: a
new table, Edge Function or third-party call changes them.

The policy is written for the GDPR: the operator is in the Netherlands, the
app is open to anyone worldwide, and every user gets the GDPR's rights
wherever they live. The lead supervisory authority is the Dutch Autoriteit
Persoonsgegevens. User data is stored in the EU (Supabase, eu-west-1 /
Ireland); the only transfers outside the EEA are the device's own Wiktionary
lookups and Apple/Google sign-in. The minimum age without a parent's
permission is 16 (the Dutch age for consent under GDPR art. 8).

The contact address in `public/privacy.html` (info@marcomarciano.com) is
temporary: switch it to the app's own address at release, and add a trade
name and KvK number if Woordkast is run as a business. The store listings need the policy's public URL:
`https://marcomarciano.com/mydutchwords/privacy.html`.

## What leaves the device

| Data | Where it goes | Code | Linked to the user | Tracking |
| --- | --- | --- | --- | --- |
| Email address | Supabase Auth | `src/lib/auth.ts` | yes | no |
| Apple / Google account id | Supabase Auth | `signInWithProvider` | yes | no |
| Deck, word edits, results, habit | `public.user_state` | `src/lib/cloudState.ts` | yes | no |
| Research log: per-answer word, exercise, result, response time (**opt-in**) | `public.review_events` | `src/lib/reviewEvents.ts`, `src/lib/research.ts` | yes | no |
| Crash reports: message, path, version, platform, user agent | `public.error_reports` | `src/lib/errorReporting.ts` | **no** | no |
| A Dutch word to speak | Edge Function `tts` → Azure | `src/lib/audio.ts` | no | no |
| A dictionary sense id | Edge Function `example` → Anthropic | `src/lib/exampleService.ts` | no | no |
| A word to look up | Wiktionary (from the device) | `src/lib/wiktionary.ts` | no | no |

Not collected: location, contacts, photos, device identifiers or advertising
id, purchases, browsing history. There are no analytics or ad SDKs, and fonts
are self-hosted (`src/assets/fonts`).

## App Store Connect → App Privacy

"Data used to track you": **none**.

| Apple category | Type | Linked to you | Purposes |
| --- | --- | --- | --- |
| Contact Info | Email Address | Yes | App Functionality |
| Identifiers | User ID | Yes | App Functionality |
| User Content | Other User Content (deck, edited words) | Yes | App Functionality |
| Usage Data | Product Interaction (results; research log when opted in) | Yes | App Functionality, Analytics |
| Diagnostics | Crash Data | No | App Functionality |

Answers to the follow-up questions: data is not used for tracking, not shared
with data brokers, and the research log is collected only with the user's
consent (Settings → Help research).

## Google Play → Data safety

- Data is encrypted in transit: **yes** (HTTPS everywhere).
- Users can request deletion: **yes**, in the app (Settings → Delete account)
  and by email.
- Collected: Personal info › Email address; App activity › App interactions
  (optional: research log); App info and performance › Crash logs; Files and
  docs: none. Shared with third parties: none (processors acting for us
  don't count as sharing).

## iOS privacy manifest (`ios/App/App/PrivacyInfo.xcprivacy`)

Add this file to the app target when the Capacitor shell is created. It
declares no tracking, the data types above, and the "required reason" API
the shell's storage uses (`UserDefaults`, via Capacitor Preferences —
reason `CA92.1`: access info from the same app). Check the Capacitor
plugins' own manifests are bundled too (Capacitor 6+ ships them).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeEmailAddress</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array><string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string></array>
    </dict>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeUserID</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array><string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string></array>
    </dict>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeOtherUserContent</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array><string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string></array>
    </dict>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeProductInteraction</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
        <string>NSPrivacyCollectedDataTypePurposeAnalytics</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeCrashData</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array><string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string></array>
    </dict>
  </array>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array><string>CA92.1</string></array>
    </dict>
  </array>
</dict>
</plist>
```

## Native shell checklist (privacy-related)

Things the web build already prepares for, to finish in the shell
(`src/lib/platform.ts` lists the plugins):

- `VITE_AUTH_REDIRECT_URL` set to the app's scheme or universal link, and
  that URL added under Supabase → Authentication → URL Configuration.
- `NSUserNotificationsUsageDescription` isn't needed for local
  notifications on iOS, but Android 13+ needs `POST_NOTIFICATIONS`.
- The app is registered for Sign in with Apple (capability in Xcode, and
  the Services ID / key in Supabase — see `docs/auth-setup.md`).
