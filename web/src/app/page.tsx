export default function Home() {
  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <h1 style={styles.logo}>Etudesk</h1>
      </header>

      <section style={styles.hero}>
        <h2 style={styles.heroTitle}>Bienvenue sur Etudesk</h2>
        <p style={styles.heroText}>Votre assistant intelligent</p>
      </section>

      <footer style={styles.footer}>
        <a href="/mentions-legales">Mentions legales</a>
        <span style={styles.copyright}>&copy; 2025 Etudesk</span>
      </footer>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '1.5rem 2rem',
    borderBottom: '1px solid #eee',
  },
  logo: {
    color: '#26449F',
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  hero: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    textAlign: 'center',
  },
  heroTitle: {
    fontSize: '2.5rem',
    color: '#26449F',
    marginBottom: '1rem',
  },
  heroText: {
    fontSize: '1.25rem',
    color: '#666',
  },
  footer: {
    padding: '1.5rem 2rem',
    borderTop: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copyright: {
    color: '#666',
    fontSize: '0.875rem',
  },
};
