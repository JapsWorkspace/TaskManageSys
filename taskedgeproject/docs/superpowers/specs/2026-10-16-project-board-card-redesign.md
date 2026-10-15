# Project Board Card Redesign

## Goal

Refresh the workspace project board so it matches the newer TaskEdge visual system while preserving the existing project data, pagination, permissions, and actions.

## Layout

- Keep a responsive two-column project grid on desktop and one column on narrower screens.
- Continue showing at most six projects per page, producing no more than three desktop rows.
- Give cards a consistent minimum height and stable internal regions so descriptions and metadata do not shift actions.

## Project Card

- Use the existing project name, description, manager, status, priority, task counts, and completion percentage.
- Add a blue folder icon and a compact active-project label for stronger hierarchy.
- Present status and priority as existing badge components.
- Show progress as a labeled percentage and a blue progress bar.
- Keep the whole main card area available for opening project details.
- Keep Edit and Archive visible only when existing permissions allow them.
- Use Lucide icons in actions and provide clear accessible labels.

## Visual System

- Use the current TaskEdge navy and cobalt palette.
- Use white cards, restrained borders, subtle shadows, and an understated hover lift.
- Keep border radii at eight pixels or less.
- Avoid nested cards and decorative elements that do not communicate project information.

## Responsive Behavior

- Two columns at desktop widths.
- One column when the workspace becomes narrow.
- Card content wraps without overlapping or resizing controls.
- Actions remain reachable and readable on mobile.

## Verification

- Add a structural test for the redesigned project-card elements.
- Run lint, the complete test suite, and the production build.
