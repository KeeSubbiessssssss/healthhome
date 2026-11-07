# Family pinboard

## Vibrant studio palette (current)

The user rejected the beige background. The current shell uses a blueberry sidebar, a rich turquoise pinboard, a fresh mint-white desk, acid-lime folder tabs and coral tape/date accents. Keep the saturated family-matched card colours and physical paper interactions. The background is a plain colour surface, not a photograph or decorative wallpaper. White instructions on the turquoise board must retain readable contrast.

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

## Components

### Weekly schedule and configurable summaries

Extend the existing vibrant scrapbook palette, handwritten headings and paper folder navigation. Weekly schedule uses seven slim day columns with family-coloured activity slips, readable times and a lime Today marker. Columns scroll horizontally on small screens; there is no empty hourly grid or week navigation. The compact activity editor contains only the title, people/pets, weekdays, start time and optional end time; a new activity takes its first assigned profile’s colour, or blue for everyone.

The schedule summary is a landscape itinerary slip with a coral top edge, folded corner and the board’s automatic pin or tape. Start at (600 × 300) canvas units; a corner handle supports pointer resizing and keyboard arrows, with Shift for fine adjustment. Constrain width to (360–900), height to (180–500), and width/height to at least (1.2). Keep the full width within the (1200)-unit board. Its contents scroll inside the paper without starting a move; free movement, rotation and automatic fastener behaviour remain shared with other notes.

Medication, Weekly schedule, Lists & tasks and Presents summaries share an options editor for visible details, a household/profile filter and pin visibility. Hiding a summary preserves its layout and schedule dimensions for repinning; this explicit summary preference is separate from ignored legacy removed-note metadata. Keep options in two columns on wide screens and one on small screens, using the existing form controls and paper treatment.

## Mobile adaptation

Phones use the blueberry brand bar and five thumb-reachable paper tabs; More opens a native focus-contained household/settings dialog. Allow safe-area insets and text zoom. Forms use 16px input text, single-column fields and at least 44px action targets. Family filters scroll in one row. Medication, presents and lists retain saturated family paper colours, compact content and readable actions.

The phone pinboard opens as a full-width, vertically scrollable stack of readable notes. Arrange switches to the saved free canvas at readable scale, preserving all desktop positions, sizes, angles and fasteners; returning to reading never writes layout. Touch movement starts only on the grip, with body swipes reserved for scrolling. Rotation and resizing remain available in Arrange. Summary schedules scroll within their paper.

Full weekly schedules flow down the phone screen, keeping all seven weekdays and side-by-side overlaps. Desktop day columns have equal widths independent of overlap count. Overlapping activities use a shared minutes-to-pixels scale within each active group: their starts, ends and overlap portions stay proportional; measured content establishes the minimum readable scale. No empty hourly grid is introduced.

## Today’s Drop/Pick

A separate lemon-paper note leads the phone pinboard and is pinned by default. It shows only the current Sydney day’s Drop/Pick arrangements, supports grouped family names and Bus transport, and refreshes its day at midnight or when the tab becomes visible. Change today and Skip today save dated exceptions; Use weekly plan removes that date’s exception. Weekly entries are never edited by these actions. The note shares the existing summary visibility/profile filter, colour, free movement and automatic fasteners. Old snapshots remain valid without daily-note metadata or dated exceptions.
