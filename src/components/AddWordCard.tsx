/* AddWordCard — "Expand the deck" promo card (Figma node 171:491 / 171:418).
   A cream card with a primary-outlined border that invites the user to
   capture a new word. Its button opens the Add-a-word flow. Used on the
   dashboard (below the hero) and at the foot of the Deck screen. */
export function AddWordCard({ onAddWord }: { onAddWord: () => void }) {
  return (
    <section className="add-word-card">
      <div className="add-word-card__content">
        <div className="add-word-card__label">Expand the deck</div>
        <h2 className="add-word-card__title">Add a new word to your deck</h2>
        <p className="add-word-card__body">
          Seen a word around you? Add it to the deck to memorize it.
        </p>
      </div>
      <button className="btn btn--primary" onClick={onAddWord}>
        Add a new word to deck
      </button>
    </section>
  );
}
