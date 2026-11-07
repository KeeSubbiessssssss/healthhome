# Family pinboard

User-approved direction: warm paper-style pinboard, movable cards, plain background. Operate mode: everyday tasks come first. HealthHome is a temporary name.

Use an oat paper canvas, saturated yellow/green/pink/blue notes with an ivory neutral, dark brown ink, quiet orange accents, a compact navigation rail, serif headings, and clear sans-serif controls. Cards have subtle paper depth and pins; interactive contents remain upright and readable. No photographic background, glass panels, glucose graphics, or provider connection UI.

Board, Lists, Medication, Gifts and Settings share the same shell. Cards move by dragging their surface or grip onto another card, with a visible drop target. Touch dragging starts from the grip or heading; move buttons remain a keyboard alternative. Fifteen paper colours, vibrant rather than pastel, are available as labelled swatches and from the palette on every card. Mobile uses a single column and horizontally scrollable navigation. Real empty states guide setup without invented family or health records.

## Scrapbook direction

The user selected a scrapbook: layered notes, tape and handwritten details. Use the locally hosted Patrick Hand font for headings and note titles, with plain sans-serif for controls and medical details. Its OFL licence is in public/fonts/PatrickHand-OFL.txt. Keep compact present cards and their family-matched colours. Notes use tape, pins, folded paper corners and subtle depth; no photos or patterned wallpaper.

Navigation uses paper folder tabs; the date is a calendar slip. The board has an actionable household strip and filters for lists, care and presents. Native view transitions provide brief page continuity and move existing note elements between positions. Respect reduced motion and fall back to immediate updates when unsupported. Data saves must finish the view update before releasing the save lock; navigation with an initial profile or editor updates atomically.

## Physical board interaction (supersedes grid and page transitions)

The user explicitly requested organic free movement, tearing and applying/removing tape and pins. The main pinboard is now a pannable, zoomable 1200-unit canvas. Notes persist arbitrary fractional x/y, angle, stack order and attachment type inside the existing board snapshot. Existing snapshots remain readable without layout fields. Lists view remains a conventional readable alternative.

Never animate pointer-driven coordinates with CSS easing, opacity ghosts or page snapshots. Each note is one live opaque DOM element; pointer movement paints translate3d in one animation frame, outside React state. Saves happen at the end of the gesture. Keyboard arrows move notes, with Shift for fine movement; rotation also has a keyboard path.

Physical pins can be pulled out and reinserted; tape peels and is pressed back down. A lower-corner pull previews a jagged tear, then puts the note into the paper tray. Tearing never deletes a list, medication or present; restoring returns the note with its saved layout. Reduced motion skips the peel/rip/fastener animation without removing the actions.

## Automatic fasteners

Fasteners are consequences of moving paper, never click-to-apply controls. At the drag threshold, the old pin falls or the tape peels away independently at its original canvas position; only that decoration becomes temporary debris. The live note remains one opaque element with immediate pointer tracking. Every completed move or rotation selects a fresh pin or tape, one of five variants, with random off-centre offset, angle and tape width. The appearance is saved with the placement, so refreshing does not randomise it. Cancellation restores the original fastener. Reduced motion keeps the same outcomes without the falling/peeling/insertion animation.

## Removed paper tray

The user removed the paper tray because the current board notes are app modules. All existing notes are visible, including notes marked hidden by older snapshots. There is no tear-off/archive gesture or tray UI. Automatic pin falling, tape peeling, random replacement fasteners and free movement remain. Legacy removedNotes metadata stays readable for compatibility but is ignored by the UI.
