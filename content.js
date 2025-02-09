// Function to parse weight/volume from text
function parseAmount(text) {
    // Try to match amount with unit
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*(г|мл|кг|л)/i);
    if (!match) return null;

    let [_, amount, unit] = match;
    amount = parseFloat(amount.replace(',', '.'));
    unit = unit.toLowerCase();

    // Convert to kg/l
    if (unit === 'г') {
        return { amount: amount / 1000, unit: 'кг' };
    } else if (unit === 'мл') {
        return { amount: amount / 1000, unit: 'л' };
    } else if (unit === 'кг' || unit === 'л') {
        return { amount, unit };
    }
    return null;
}

// Function to parse price from text
function parsePrice(text) {
    // Remove spaces and replace comma with dot
    const cleanText = text.replace(/\s+/g, '').replace(',', '.');
    // Match number before ₽ symbol
    const match = cleanText.match(/(\d+(?:\.\d+)?)\s*₽/);
    return match ? parseFloat(match[1]) : null;
}

// Function to parse price per unit from volume text
function parsePricePerUnit(text) {
    // Try to match pattern like "446,99 ₽ за 1 кг"
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*₽\s+за\s+(?:\d+(?:[.,]\d+)?)\s*(г|мл|кг|л)/i);
    if (!match) return null;

    let [_, price, unit] = match;
    price = parseFloat(price.replace(',', '.'));
    unit = unit.toLowerCase();

    // Convert to kg/l if needed
    if (unit === 'г') {
        unit = 'кг';
    } else if (unit === 'мл') {
        unit = 'л';
    }

    return { price, unit };
}

// Function to add price per kg/l to a product card
function addPricePerUnit(card) {
    // Check if we already processed this card
    if (card.hasAttribute('data-price-per-unit-added')) return;

    // Find volume element
    const volumeEl = card.querySelector('[data-qa$="_volume"]');
    if (!volumeEl) return;

    // First try to get price per unit from volume text
    const pricePerUnitInfo = parsePricePerUnit(volumeEl.textContent);

    if (pricePerUnitInfo) {
        // Use the price per unit directly from the volume text
        addPriceElement(card, pricePerUnitInfo.price, pricePerUnitInfo.unit);
    } else {
        // Calculate price per unit from product price and amount
        const amountInfo = parseAmount(volumeEl.textContent);
        if (!amountInfo) return;

        // Find price element - first try discounted price, then regular price
        const priceEl = card.querySelector('[class*=ProductCardPrice_accent][data-qa$="_price"]') ||
                       card.querySelector('[data-qa$="_price"]');
        if (!priceEl) return;

        const price = parsePrice(priceEl.textContent);
        if (!price) return;

        // Calculate price per unit
        const pricePerUnit = price / amountInfo.amount;
        addPriceElement(card, pricePerUnit, amountInfo.unit);
    }

    // Mark card as processed
    card.setAttribute('data-price-per-unit-added', 'true');
}

// Helper function to add price element to card
function addPriceElement(card, price, unit) {
    const newPriceEl = document.createElement('div');
    newPriceEl.style.fontSize = '14px';
    newPriceEl.style.color = '#666';
    newPriceEl.style.paddingTop = 0;
    newPriceEl.textContent = `${price.toFixed(2)} ₽/${unit}`;

    // Find price element to insert after
    const priceEl = card.querySelector('[class*=ProductCardPrice_accent][data-qa$="_price"]') ||
                   card.querySelector('[data-qa$="_price"]');
    if (priceEl) {
        const priceWrapper = priceEl.closest('[class*=ProductCardPrice_price]');
        if (priceWrapper) {
            priceWrapper.parentNode.insertBefore(newPriceEl, priceWrapper.nextSibling);
        }
    }
}

// Debounce function to limit how often we process cards
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Function to process all product cards on the page
const processProductCards = debounce(() => {
    const cards = document.querySelectorAll('[class*="ProductCard_root"]'); // VERY RISKY!
    cards.forEach(addPricePerUnit);
}, 250); // Wait 250ms between processing attempts

// Wait for page to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processProductCards);
} else {
    processProductCards();
}

// Set up observer for dynamic content
const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            shouldProcess = true;
            break;
        }
    }
    if (shouldProcess) {
        processProductCards();
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
