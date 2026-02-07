let autoLoadMoreEnabled = false;
let observer = null;

function clickLoadMoreButtons() {
    const buttons = document.querySelectorAll('button.ajax-pagination-btn');

    buttons.forEach(button => {
        if (button.textContent.trim() === 'Load more…' && !button.disabled) {
            button.click();
        }
    });
}

function startAutoLoadMore() {
    if (observer) {
        observer.disconnect();
    }

    observer = new MutationObserver((mutationsList) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList' || mutation.type === 'subtree') {
                clickLoadMoreButtons();
            }
        }
    });

    observer.observe(document.body, {childList: true, subtree: true});
    clickLoadMoreButtons();
}

function stopAutoLoadMore() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
}

function resolveAllDiscussions() {
    const resolveButtons = document.querySelectorAll('button[value="resolve"], button[name="comment_and_resolve"]');

    resolveButtons.forEach(button => {
        const container = button.closest('[data-review-thread="true"]');
        if (container && container.getAttribute('data-resolved') !== 'true') {
            button.click();
        }
    });

    let iterations = 0;
    const maxIterations = 20;

    const checkForNewDiscussions = setInterval(() => {
        iterations++;
        const newResolveButtons = document.querySelectorAll('button[value="resolve"], button[name="comment_and_resolve"]');
        let newResolved = 0;

        newResolveButtons.forEach(button => {
            const container = button.closest('[data-review-thread="true"]');
            if (container && container.getAttribute('data-resolved') !== 'true') {
                button.click();
                newResolved++;
            }
        });

        if (newResolved === 0 || iterations >= maxIterations) {
            clearInterval(checkForNewDiscussions);
        }
    }, 500);
}

function hasUnresolvedChildDiscussions(element) {
    const childDiscussions = element.querySelectorAll('[data-review-thread="true"]');
    for (let discussion of childDiscussions) {
        if (discussion !== element && discussion.getAttribute('data-resolved') !== 'true') {
            return true;
        }
    }
    return false;
}

function setAsHidden() {
    const discussions = document.querySelectorAll('[data-review-thread="true"]');
    const regularComments = document.querySelectorAll('.timeline-comment');

    const hideElement = async (element, delay = 0) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const detailsMenu = element.querySelector('details.discussion-timeline-actions');
                if (!detailsMenu) {
                    resolve(false);
                    return;
                }

                if (!detailsMenu.open) {
                    const summary = detailsMenu.querySelector('summary');
                    if (!summary) {
                        resolve(false);
                        return;
                    }
                    summary.click();
                }

                setTimeout(() => {
                    const hideButton = detailsMenu.querySelector('button[value="hide"]');
                    if (!hideButton) {
                        resolve(false);
                        return;
                    }

                    hideButton.click();

                    setTimeout(() => {
                        const confirmButton = document.querySelector('button[name="comment[state_event]"][value="outdated"]');
                        if (confirmButton) {
                            confirmButton.click();
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    }, 150);
                }, 150);
            }, delay);
        });
    };

    const processElements = async () => {
        let delay = 0;

        for (let discussion of discussions) {
            const isResolved = discussion.getAttribute('data-resolved') === 'true';

            if (isResolved && !hasUnresolvedChildDiscussions(discussion)) {
                const success = await hideElement(discussion, delay);
                if (success) {
                    delay += 300;
                }
            }
        }

        for (let comment of regularComments) {
            const isPartOfDiscussion = comment.closest('[data-review-thread="true"]');
            if (!isPartOfDiscussion && !hasUnresolvedChildDiscussions(comment)) {
                const success = await hideElement(comment, delay);
                if (success) {
                    delay += 300;
                }
            }
        }
    };

    processElements();
}

function createControlPanel() {
    if (document.getElementById('github-pr-control-panel')) {
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'github-pr-control-panel';
    panel.innerHTML = `
        <style>
            #github-pr-control-panel {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #ffffff;
                border: 1px solid #d0d7de;
                border-radius: 6px;
                padding: 16px;
                box-shadow: 0 8px 24px rgba(140, 149, 159, 0.2);
                z-index: 9999;
                min-width: 250px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            }
            #github-pr-control-panel h3 {
                margin: 0 0 12px 0;
                font-size: 14px;
                font-weight: 600;
                color: #24292f;
            }
            #github-pr-control-panel .control-item {
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            #github-pr-control-panel .control-item:last-child {
                margin-bottom: 0;
            }
            #github-pr-control-panel label {
                font-size: 12px;
                color: #57606a;
                margin-right: 8px;
            }
            #github-pr-control-panel .toggle-switch {
                position: relative;
                width: 40px;
                height: 20px;
                background-color: #d0d7de;
                border-radius: 10px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            #github-pr-control-panel .toggle-switch.active {
                background-color: #2da44e;
            }
            #github-pr-control-panel .toggle-switch::after {
                content: '';
                position: absolute;
                top: 2px;
                left: 2px;
                width: 16px;
                height: 16px;
                background-color: white;
                border-radius: 50%;
                transition: transform 0.2s;
            }
            #github-pr-control-panel .toggle-switch.active::after {
                transform: translateX(20px);
            }
            #github-pr-control-panel button {
                width: 100%;
                padding: 6px 12px;
                font-size: 12px;
                font-weight: 500;
                color: #24292f;
                background-color: #f6f8fa;
                border: 1px solid #d0d7de;
                border-radius: 6px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            #github-pr-control-panel button:hover {
                background-color: #f3f4f6;
            }
            #github-pr-control-panel button:active {
                background-color: #ebecf0;
            }
        </style>
        <h3>PR Discussions Control</h3>
        <div class="control-item">
            <label>Auto Load More</label>
            <div class="toggle-switch" id="auto-load-toggle"></div>
        </div>
        <div class="control-item">
            <button id="resolve-all-btn">Resolve All</button>
        </div>
        <div class="control-item">
            <button id="set-hidden-btn">Set as Hidden</button>
        </div>
    `;

    document.body.appendChild(panel);

    const autoLoadToggle = document.getElementById('auto-load-toggle');
    const resolveAllBtn = document.getElementById('resolve-all-btn');
    const setHiddenBtn = document.getElementById('set-hidden-btn');

    chrome.storage.local.get(['autoLoadMoreEnabled'], (result) => {
        autoLoadMoreEnabled = result.autoLoadMoreEnabled || false;
        if (autoLoadMoreEnabled) {
            autoLoadToggle.classList.add('active');
            startAutoLoadMore();
        }
    });

    autoLoadToggle.addEventListener('click', () => {
        autoLoadMoreEnabled = !autoLoadMoreEnabled;
        chrome.storage.local.set({ autoLoadMoreEnabled });

        if (autoLoadMoreEnabled) {
            autoLoadToggle.classList.add('active');
            startAutoLoadMore();
        } else {
            autoLoadToggle.classList.remove('active');
            stopAutoLoadMore();
        }
    });

    resolveAllBtn.addEventListener('click', () => {
        resolveAllDiscussions();
        console.log('Resolving all discussions...');
    });

    setHiddenBtn.addEventListener('click', () => {
        setAsHidden();
        console.log('Hiding resolved items...');
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createControlPanel);
} else {
    createControlPanel();
}
