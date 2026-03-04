# GitHub Pull Requests Code Review Enhancements

Chrome extension that provides advanced batch operations and controls for managing GitHub Pull Request discussions.

## Features

- **Auto-load-more discussions** – Automatically clicks "Load more..." buttons to reveal all PR comments continuously
- **Batch resolve discussions** – One-click resolution of all unresolved discussions (shows count in parentheses)
- **Batch hide comments** – Hide resolved only discussions and regular comments with a single click (shows count in parentheses)
- **Mark as ready** – One-click to mark draft PR as ready for review - no need to search for original GitHub controls, just click on the extension's layer
- **Request Copilot review** – Adds Copilot as a reviewer - no need to search for original GitHub controls, just click on the extension's layer
- **Smart filtering** – Automatically skips hiding PR description and parent comment with unresolved child discussions
- **Reactive updates** – Uses MutationObserver to handle dynamically loaded content efficiently

## Installation

1. Download this extension as ZIP file from [releases page](https://github.com/Rawdogs-pl/Github-Pull-Requests-Code-Review-Enhancements/releases). Then unzip downloaded archive. 
2. Navigate to `chrome://extensions` in your browser.
3. Enable **Developer mode** (toggle in top-right corner).
4. Click **Load unpacked** and select the extension directory.
5. The extension is ready to use.

## Usage

When you open a Pull Request on GitHub, a control panel will appear in the lower right corner of the page with the following options:

### Auto Load More

Toggle this switch to automatically load all hidden discussions by clicking "Load more..." buttons. 

**How it works:**
- Continuously monitors the page for "Load more..." buttons
- Automatically clicks them to reveal all PR comments
- Uses MutationObserver for efficient DOM monitoring
- Toggle on/off anytime using the switch or keyboard (Space/Enter)

### Resolve All

Click this button to automatically resolve all unresolved discussions in the PR. The button displays the count of discussions that will be resolved in parentheses.

**How it works:**
- Scans for all unresolved discussion threads
- Clicks the "Resolve discussion" button for each one
- Uses scoped selectors (`.js-resolvable-timeline-thread-form button[value="resolve"]`) to avoid unintended submissions
- Monitors for newly loaded discussions for up to 10 seconds
- Only processes each thread once, after confirming successful resolution
- Handles dynamically loaded content reactively

### Hide resolved and comments

Click this button to hide resolved discussions and regular comments by marking them as outdated. The button displays the count of items that will be hidden in parentheses.

**How it works:**
- Identifies all resolved discussions and regular comments
- Opens the menu for each item and clicks "Hide" → "Outdated"
- **Smart filtering:**
  - Skips PR description (cannot be hidden)
  - Skips parent elements that contain unresolved child discussions
  - Only hides items that are already resolved or are standalone comments
- Uses `waitFor` helper for reliable element detection
- Processes items sequentially with rate limiting (300ms delay)
- Comprehensive logging for debugging

### Mark as ready

Click this button to mark a draft Pull Request as ready for review. This button is only visible when the PR is in draft state.

**How it works:**
- Automatically detects the "Ready for review" button on GitHub PR page
- Button is only visible when PR is in draft state
- Dynamically monitors DOM changes to show/hide button in real-time
- Clicks the native GitHub "Ready for review" button when activated
- Logs actions to console for debugging

### Request Copilot review

Click this button to add Copilot as a reviewer to the Pull Request.

**How it works:**
- Opens the reviewers selection menu
- Activates the filter field to make Copilot option visible
- Selects "Your AI Pair Programmer" (Copilot) from the menu
- Closes the menu automatically after selection
- Uses simulated interactions to ensure reliable operation
- Comprehensive error handling with console logging for debugging

## Technical Details

- **Permissions:** Storage and host permissions for `https://github.com/*/*/pull/*`
- **Content Security Policy:** Styles loaded via external CSS file to avoid CSP restrictions
- **Accessibility:** Keyboard accessible with `role="switch"`, `aria-checked`, and `:focus-visible` styles
- **Performance:** Optimized MutationObserver only scans added nodes, not entire document
- **Reliability:** Confirms successful state changes before marking operations as complete

## Screenshots

Control panel in the lower right corner:

<img width="1357" height="673" alt="image" src="https://github.com/user-attachments/assets/0c29b777-4e63-480c-b3f5-d8de9d9f2c01" />

**Note:** The panel can be closed by clicking the X button in the top-right corner. It will reappear when you reload the page.

## Development

The extension consists of:
- `manifest.json` - Extension configuration with permissions and content scripts
- `github.js` - Main content script with all functionality
- `panel.css` - Styles for the control panel
- `background.js` - Service worker for icon state management

## License

The MIT license. See LICENSE file for details.

