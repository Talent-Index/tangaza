/** Inline boot script for layout.tsx — keep in sync with components/theme.tsx STORAGE_KEY. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('ubu-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}if(t==='light')document.documentElement.classList.add('light');document.documentElement.style.colorScheme=t}catch(e){}`;
