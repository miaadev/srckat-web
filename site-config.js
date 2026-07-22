// I hate fucking around with this. 
// It makes me want to scream.

// API Configuration
const API_CONFIG = {
    nsHost: 'https://ns.miaa.dev',
    profileId: 'miaadev',
    productId: 'product_5cafa9c5-b53b-439a-8639-79ed8766f5d2',
    timeout: 5000,
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

// Resolve the nameserver record once, returning both the API base URL
// and the PrimaryCDN base URL that the NS host publishes.
async function resolveNameserverRecord() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
    try {
        const response = await fetch(API_CONFIG.nsHost, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`Nameserver error! status: ${response.status}`);
        }
        const data = await response.json();
        if (!data.API || typeof data.API !== 'string') {
            throw new Error('Nameserver response missing "API" key');
        }
        if (!data.PrimaryCDN || typeof data.PrimaryCDN !== 'string') {
            throw new Error('Nameserver response missing "PrimaryCDN" key');
        }
        return {
            apiBaseUrl: data.API.replace(/\/$/, ''),
            primaryCdn: data.PrimaryCDN.replace(/\/$/, '')
        };
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Fetch the product record from API_BASE_URL/api/v1/product/PRODUCT_ID
async function fetchProduct(apiBaseUrl, attempt = 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
    try {
        const endpoint = `${apiBaseUrl}/api/v1/product/${encodeURIComponent(API_CONFIG.productId)}/payload`;
        const response = await fetch(endpoint, {
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' }
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        if (attempt < API_CONFIG.retryAttempts) {
            console.warn(`Product fetch attempt ${attempt} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            return fetchProduct(apiBaseUrl, attempt + 1);
        }
        throw error;
    }
}

// Set the favicon to `${primaryCdn}/useruploads/${userUploadBlob}`
function setFavicon(primaryCdn, userUploadBlob) {
    if (!userUploadBlob) return;
    const href = `${primaryCdn}/useruploads/${userUploadBlob}`;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = href;
}

// Fetch configuration from API (resolves NS, fetches product, sets favicon)
async function fetchConfig(attempt = 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
    try {
        const { apiBaseUrl, primaryCdn } = await resolveNameserverRecord();

        const productData = await fetchProduct(apiBaseUrl);

        // Set favicon from the product's user_upload_blob key, if present
        setFavicon(primaryCdn, productData.user_upload_blob);

        clearTimeout(timeoutId);
        if (!validateConfig(productData)) {
            throw new Error('Invalid configuration format received from API');
        }
        return productData;
    } catch (error) {
        clearTimeout(timeoutId);
        if (attempt < API_CONFIG.retryAttempts) {
            console.warn(`Fetch attempt ${attempt} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            return fetchConfig(attempt + 1);
        }
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

    body.innerHTML += renderHeader(config.header);
    const mainContent = config.sections.map(section => renderSection(section)).join('\n');
    body.innerHTML += `<main>${mainContent}</main>`;
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
