import Link from 'next/link';

export default function MentionsLegales() {
  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <Link href="/" style={styles.logo}>Etudesk</Link>
      </header>

      <article style={styles.content}>
        <h1 style={styles.title}>Mentions Legales</h1>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Editeur du site</h2>
          <p>Etudesk</p>
          <p>Email : contact@etudesk.com</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Hebergement</h2>
          <p>A completer</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Propriete intellectuelle</h2>
          <p>
            L&apos;ensemble du contenu de ce site (textes, images, logos) est protege
            par le droit de la propriete intellectuelle.
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Donnees personnelles</h2>
          <p>
            Les informations collectees sur ce site sont traitees conformement
            au RGPD. Pour toute question, contactez-nous.
          </p>
        </section>
      </article>

      <footer style={styles.footer}>
        <Link href="/">Retour a l&apos;accueil</Link>
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
    textDecoration: 'none',
  },
  content: {
    flex: 1,
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2rem',
  },
  title: {
    color: '#26449F',
    fontSize: '2rem',
    marginBottom: '2rem',
  },
  section: {
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    marginBottom: '0.5rem',
    color: '#1a1a1a',
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
