// API Configuration
const API_CONFIG = {
    // Option 1: Use a remote API endpoint
    endpoint: 'https://mothership-prod-hive.miaa.dev/api/portfolio/miaadev',
    // Option 2: Use a local JSON file
    // endpoint: '/data/site-config.json',
    // Timeout in milliseconds
    timeout: 5000,
    // Retry attempts
    retryAttempts: 2
};
// Fallback configuration (used if API fails)
const FALLBACK_CONFIG = {
    header: {
        name: "miaadev",
        tagline: "Software Developer"
    },
    sections: [
        {
            legend: "About",
            content: {
                type: 'text',
                text: "Loading failed. Please try again later."
            }
        }
    ],
    footer: {
        text: `© ${new Date().getFullYear()} miaadev.`
    }
};
// Loading indicator functions
function showLoading() {
    const loader = document.createElement('div');
    loader.id = 'loading-indicator';
    loader.innerHTML = `
    <div class="spinner"></div>
    <p>Loading site data...</p>
  `;
    document.body.appendChild(loader);
}
function hideLoading() {
    const loader = document.getElementById('loading-indicator');
    if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 300);
    }
}
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
    <h2>⚠️ Error Loading Site</h2>
    <p>${escapeHtml(message)}</p>
    <p>Using fallback configuration...</p>
  `;
    document.body.insertBefore(errorDiv, document.body.firstChild);
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.classList.add('fade-out');
        setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
}
// Fetch configuration from API
async function fetchConfig(attempt = 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
    try {
        const response = await fetch(API_CONFIG.endpoint, {
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
            }
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Validate the response
        if (!validateConfig(data)) {
            throw new Error('Invalid configuration format received from API');
        }
        return data;
    }
    catch (error) {
        clearTimeout(timeoutId);
        // Retry logic
        if (attempt < API_CONFIG.retryAttempts) {
            console.warn(`Fetch attempt ${attempt} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            return fetchConfig(attempt + 1);
        }
        // All attempts failed
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to fetch config:', errorMessage);
        showError(errorMessage);
        return FALLBACK_CONFIG;
    }
}
// Validate configuration structure
function validateConfig(data) {
    return (data &&
        typeof data === 'object' &&
        data.header &&
        typeof data.header.name === 'string' &&
        typeof data.header.tagline === 'string' &&
        Array.isArray(data.sections) &&
        data.footer &&
        typeof data.footer.text === 'string');
}
// Render functions
function renderHeader(header) {
    return `
    <header>
      <h1>${escapeHtml(header.name)}</h1>
      <p>${escapeHtml(header.tagline)}</p>
    </header>
  `;
}
function renderSection(section) {
    const content = renderSectionContent(section.content);
    return `
    <fieldset>
      <legend>${escapeHtml(section.legend)}</legend>
      ${content}
    </fieldset>
  `;
}
function renderSectionContent(content) {
    switch (content.type) {
        case 'text':
            return `<p>${escapeHtml(content.text)}</p>`;
        case 'list':
            return `
        <ul>
          ${content.items.map(item => `<li>${escapeHtml(item)}</li>`).join('\n')}
        </ul>
      `;
        case 'projects':
            return content.projects.map(project => `
        <div class="project">
          <h3>${escapeHtml(project.title)}</h3>
          <p>${escapeHtml(project.description)}${project.url ? ` <a href="${escapeHtml(project.url)}">View Project</a>` : ''}</p>
          ${project.tags ? `<p class="tags">${project.tags.map(tag => `<code>${escapeHtml(tag)}</code>`).join(' ')}</p>` : ''}
        </div>
      `).join('\n');
        case 'links':
            return `
        <p class="links">
          ${content.links.map(link => `<a href="${escapeHtml(link.url)}">${escapeHtml(link.text)}</a>`).join(' | ')}
        </p>
      `;
        case 'html':
            return content.html;
        default:
            return '';
    }
}
function renderFooter(footer) {
    return `
    <footer>
      <p>${escapeHtml(footer.text)}</p>
    </footer>
  `;
}
function renderSite(config) {
    const body = document.body;
    // Clear existing content (except loading indicator)
    const loader = document.getElementById('loading-indicator');
    body.innerHTML = '';
    if (loader) {
        body.appendChild(loader);
    }
    // Render header
    body.innerHTML += renderHeader(config.header);
    // Render sections
    const mainContent = config.sections.map(section => renderSection(section)).join('\n');
    body.innerHTML += `<main>${mainContent}</main>`;
    // Render footer
    body.innerHTML += renderFooter(config.footer);
}
// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
// Initialize site when DOM is ready
async function initSite() {
    showLoading();
    try {
        const config = await fetchConfig();
        renderSite(config);
    }
    catch (error) {
        console.error('Fatal error:', error);
        renderSite(FALLBACK_CONFIG);
    }
    finally {
        hideLoading();
    }
}
// Start the app
document.addEventListener('DOMContentLoaded', initSite);
// Export for use in other modules
export { fetchConfig, renderSite };
