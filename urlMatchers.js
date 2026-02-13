// Shared URL pattern matcher for GitHub Pull Request pages
// Pattern matches paths like: /{owner}/{repo}/pull/{number}
// This prevents activation on /agents/pull/ pages
const PR_PATH_PATTERN = /^\/[^/]+\/[^/]+\/pull\/\d+(?:\/|$)/;

/**
 * Check if a URL is a GitHub Pull Request page
 * @param {string} url - Full URL or pathname to check
 * @returns {boolean} True if URL is a PR page
 */
function isGitHubPRPage(url) {
    try {
        // Handle both full URLs and pathnames
        const pathname = url.startsWith('/') ? url : new URL(url).pathname;
        return PR_PATH_PATTERN.test(pathname);
    } catch (e) {
        return false;
    }
}
