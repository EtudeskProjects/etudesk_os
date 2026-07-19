/** Idempotently creates the public communities used by the personalized onboarding. */
import { pool, generateSlug } from '../services/database';

const communities = [
  { name: 'IA au travail', sectors: ['PROFESSIONAL_SERVICES', 'PUBLIC', 'DIGITAL'], description: '7 jours pour utiliser l’IA dans ses documents, son organisation et sa recherche d’emploi.' },
  { name: 'Emploi express', sectors: ['PROFESSIONAL_SERVICES', 'PUBLIC', 'EDUCATION'], description: 'CV, entretiens, candidatures et défis quotidiens pour accélérer sa recherche.' },
  { name: 'Commerce digital', sectors: ['COMMERCE', 'MEDIA', 'PROFESSIONAL_SERVICES'], description: 'Vendre avec WhatsApp Business, créer du contenu et mieux suivre ses clients.' },
  { name: 'Excel, data & reporting', sectors: ['FINANCE', 'PROFESSIONAL_SERVICES', 'INDUSTRY', 'DIGITAL'], description: 'Des défis pratiques pour gagner en aisance avec les données et le reporting.' },
  { name: 'Enseigner avec le numérique', sectors: ['EDUCATION', 'RESEARCH'], description: 'Créer des quiz, supports et activités pédagogiques avec les bons outils.' },
  { name: 'Digital starter', sectors: ['DIGITAL', 'PROFESSIONAL_SERVICES', 'COMMERCE'], description: 'Le parcours de départ pour acquérir des compétences numériques utiles dans tous les métiers.' },
] as const;

async function main() {
  const organization = await pool.query(`SELECT id FROM organizations WHERE slug='etudesk' AND deleted_at IS NULL LIMIT 1`);
  const organizationId = organization.rows[0]?.id ?? null;
  for (const community of communities) {
    const slug = generateSlug(community.name);
    await pool.query(
      `INSERT INTO communities (id,name,slug,type,description,rules,access_type,visibility,sectors,tags,country,status,organization_id)
       VALUES (uuid_generate_v4(),$1,$2,'LEARNING',$3,$4,'OPEN','PUBLIC',$5,$6,'CI','ACTIVE',$7)
       ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, sectors=EXCLUDED.sectors, tags=EXCLUDED.tags, status='ACTIVE', updated_at=NOW()`,
      [community.name, slug, community.description, 'Respect, entraide et partage de réalisations concrètes.', JSON.stringify(community.sectors), JSON.stringify(['challenge-7-jours', 'cote-divoire', 'onboarding']), organizationId]
    );
    console.log(`✓ ${community.name}`);
  }
}

main().then(() => pool.end()).catch(async (error) => { console.error(error); await pool.end(); process.exit(1); });
