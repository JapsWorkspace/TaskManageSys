# Role-Aware Task Details Design

## Goal

Redesign the clicked-task detail page to follow the supplied reference's information hierarchy while displaying only functionality and data that TaskEdge already supports. The task queue is explicitly out of scope and must remain unchanged.

## Role And Relationship Model

Account roles and task relationships are independent:

- `admin` and `manager` are account roles.
- `assignee`, `collaborator`, `watcher`, and `reporter` are relationships to one task.
- A manager may also be the assignee. In that case, the manager receives assignee work controls in addition to permitted management controls.
- A manager who only supervises the task receives management and review controls, but no attachment upload or direct subtask-completion controls.

Effective behavior:

- Assignee: update status, progress, and subtasks; upload and remove task attachments; comment.
- Collaborator: update status and progress; view subtasks and attachments; comment.
- Managing manager or admin: edit task configuration, change status, archive, and delete where existing ownership rules permit; view and download attachments; comment. They may only use assignee work controls when they are also the assignee.
- Watcher: read task content and attachments; comment.
- Unrelated user: no task access through the API.

## Page Structure

### Header

- Back-to-tasks command.
- Project name as context.
- Task title and existing description.
- Status, priority, and deadline badges.
- Compact assignee summary.
- No fabricated task code, task brief, acceptance criteria, or other unsupported reference content.

### Control Bar

- Managing manager/admin: status selector and Edit, Archive, and permitted Delete commands.
- Assignee or collaborator: Update progress command.
- Watcher: View only indicator.
- A manager who is also the assignee can see both appropriate management commands and assignee work actions without duplicate status controls.

### Main Content

Use a wide primary column and a narrower information column.

Primary column:

- Task overview using the existing description.
- Dependencies, only when present.
- Subtasks with completion count and progress bar.
- Comments and comment composer.

Information column:

- Existing task metadata: status, priority, dates, project, assignee, reporter, collaborators, recurrence, category, and tags when available.
- Attachments with Open and Download actions for viewers.
- Upload and Remove actions only for the task assignee.

On narrow screens, sections collapse into one column while actions remain visible and logically ordered.

## Interaction And Motion

- Use the system's existing typography, colors, buttons, panels, and border treatment.
- Add a restrained staggered entrance for the header, overview, metadata, subtasks, attachments, and comments.
- Animate subtask progress changes and attachment row insertion/removal.
- Respect reduced-motion preferences.
- Keep all dimensions responsive and prevent labels or actions from overlapping.

## Authorization

Frontend visibility and backend enforcement must agree.

- Attachment upload/removal requires the current user to be the task assignee.
- Direct subtask mutation requires the current user to be the task assignee, except full task configuration changes made through the authorized management edit flow.
- Collaborator limited updates accept status and progress only.
- Managing managers/admins cannot use attachment upload/removal unless also assigned.
- Forbidden fields or actions return `403 Forbidden` without partially applying the request.

## Testing

- Update permission unit tests for assignee, collaborator, watcher, managing manager, manager-assignee, unrelated manager, and admin.
- Add backend tests for attachment and limited-progress authorization.
- Verify task detail rendering and responsive behavior at desktop, tablet, and mobile widths.
- Run frontend tests, backend tests, lint, and production build.
- Confirm no TaskQueuePanel code or task-queue CSS changes are included.

## Out Of Scope

- Task queue layout, behavior, sorting, grouping, or animation.
- New task fields such as task brief or acceptance criteria.
- New submission-review workflows; individual activities retain their existing review system.
