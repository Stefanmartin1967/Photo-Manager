export const themes = ['maritime', 'desert', 'oasis', 'night'];

export function init() {
    const savedTheme = localStorage.getItem('theme') || 'maritime';
    setTheme(savedTheme);

    const selector = document.getElementById('themeSelector');
    if (selector) {
        selector.value = savedTheme;
        selector.addEventListener('change', (e) => {
            setTheme(e.target.value);
        });
    } else {
        console.warn('Theme selector not found in DOM');
    }
}

export function setTheme(themeName) {
    if (themes.includes(themeName)) {
        document.documentElement.setAttribute('data-theme', themeName);
        localStorage.setItem('theme', themeName);
    }
}
