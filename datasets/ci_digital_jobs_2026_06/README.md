# Offres numeriques CI - juin 2026

Dataset de travail pour importer des opportunites externes en Cote d'Ivoire.

Les sources viennent de la capture `IMG_67B82B961C52-1.jpeg` et de recherches web publiques effectuees le 30 juin 2026. Le fichier principal est `jobs_ci_digital_2026_06.json`.

## Regles d'import

- `application_mode` vaut toujours `EMAIL` pour ces offres externes.
- `import_ready` vaut `true` uniquement quand un email recruteur a ete trouve sur la fiche source.
- Les offres LinkedIn et Novojob sans email restent dans le dataset pour enrichissement, mais ne doivent pas etre importees tant que `external_apply_email` est `null`.
- Le sujet email attendu cote app est `Candidature a l'offre xxx`.
- L'agent/copilot ne doit pas creer d'enregistrement dans `opportunity_applications` pour ces offres.

## Notes

LinkedIn expose surtout le lien de candidature, pas l'email recruteur. Ces lignes sont donc utiles pour sourcing et enrichissement manuel, mais pas encore pour le flux email strict demande.
