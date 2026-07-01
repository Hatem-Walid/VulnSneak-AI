import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('vs-theme') || 'dark'
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('vs-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    /* Brief transition class so color props animate only during the switch */
    document.documentElement.classList.add('theme-switching');
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
    
    setTimeout(() => {
      document.documentElement.classList.remove('theme-switching');
    }, 350);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);