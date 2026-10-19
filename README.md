# RV : RevolutionProject

Page de pré-ouverture en français pour RV : RevolutionProject. Le logo fourni est intégré en PNG transparent dans `assets/rv-logo.png`; l’accueil affiche une annonce mystérieuse et « ouverture prochaine » tant que le projet n’est pas ouvert. Une section présente Laélien, Corentin, la mission et la manière dont le projet veut avancer.

## Aperçu

Ouvre `index.html` pour l’accueil et `admin.html` pour le panel. Une fois Supabase configuré, le panel utilise un compte Supabase Auth et les modifications enregistrées sont partagées avec tous les visiteurs. Le formulaire de contact enregistre les demandes dans la boîte partagée du panel.

Le panel permet d’éditer les textes, créer des pages, ajouter des projets avec tags et images, publier des avancées, organiser plusieurs progressions et leurs étapes, modifier le schéma d’accueil, et gérer les vidéos YouTube. Import/export JSON est disponible. Les photos sont optimisées en WebP.

Le thème passe automatiquement en sombre de 19 h à 9 h et en clair de 9 h à 19 h, selon l’heure locale. Le visiteur peut aussi le changer manuellement jusqu’au prochain changement automatique.

## GitHub Pages et Supabase

GitHub Pages héberge les pages statiques ; Supabase fournit l’authentification et la base de données. La clé publishable présente dans `supabase-cloud.js` est conçue pour le navigateur, avec les règles RLS configurées par le script SQL. N’ajoute jamais de clé `secret` ou `service_role` au code du site.

Le site démarre avec le texte par défaut et des listes vides. Après la configuration ci-dessous, importe un JSON depuis le panel si tu veux charger un contenu déjà préparé. Le mode admin fonctionne sur le site publié en HTTPS, pas quand tu ouvres les fichiers avec `file://`.

## Publication

1. Crée un dépôt GitHub et ajoute les fichiers du projet à sa racine.
2. Dans **Settings → Pages**, choisis **Deploy from a branch**, puis `main` et le dossier `/ (root)`.
3. Enregistre. GitHub Pages indiquera l’adresse publique du site.

Le site n’a pas besoin d’installation ou de compilation. Les animations respectent le réglage système « réduire les animations ».

Sur la page Progression, chaque étape publiée possède sa barre indépendante. Dans l’admin, tu peux en ajouter plusieurs, modifier le pourcentage et voir l’aperçu évoluer immédiatement. La barre globale reste visible : elle affiche la moyenne des pourcentages des étapes publiées (0 % s’il n’y en a pas encore).


## Connexion à Supabase (publication partagée)

Le site utilise Supabase pour partager les textes, annonces, avancées, progressions, schéma, vidéos et demandes de contact sur tous les appareils. La clé `sb_publishable_…` intégrée à `supabase-cloud.js` est une clé publique destinée au navigateur ; aucune clé `secret` ou `service_role` ne doit être ajoutée au dépôt.

### Configuration unique

1. Dans Supabase, ouvre **Authentication → Users** et crée ton compte administrateur. Dans les réglages d’authentification, désactive l’inscription publique.
2. Dans **SQL Editor**, exécute [`supabase/setup.sql`](supabase/setup.sql). Les droits d’administration sont désormais limités à une liste privée d’identifiants utilisateurs ; les demandes de contact ont des limites de taille et une limite de trois envois par adresse e-mail sur dix minutes.
3. Dans **Authentication → Users**, copie l’UUID de ton compte admin. Dans SQL Editor, exécute cette commande en remplaçant la valeur entre apostrophes par cet UUID :

   ```sql
   insert into private.site_admins (user_id)
   values ('COLLE-ICI-L-UUID-DE-TON-COMPTE');
   ```

   Cette étape est nécessaire pour que le panel puisse publier et consulter les demandes. Ne partage pas l’UUID avec le public.
4. Publie les fichiers du dépôt sur GitHub Pages. Utilise l’adresse HTTPS du site ; l’authentification Supabase et les appels réseau ne fonctionnent pas en ouvrant directement les fichiers `file://`.
5. Connecte-toi sur `admin.html` avec l’adresse e-mail et le mot de passe du compte créé. Enregistre ou importe le contenu depuis ce panel : il sera alors visible par tous les visiteurs.
6. Pour activer les statistiques consenties, crée une clé IPWho sur [ipwho.org](https://www.ipwho.org/free-plan). Dans **Supabase → Edge Functions → Secrets**, ajoute `IPWHO_API_KEY` avec cette clé et `SITE_ORIGINS` avec l’origine de ton site (ex. `https://ton-compte.github.io`, sans le chemin `/RevolutionProjectOfficiel`). Ne mets jamais ces secrets dans GitHub.
7. Déploie la fonction avec Supabase CLI depuis la racine du dépôt : `npx supabase login`, puis `npx supabase link --project-ref gkshnhdegrfscficfjye` et `npx supabase functions deploy rv-analytics --no-verify-jwt --project-ref gkshnhdegrfscficfjye`. Le projet Supabase doit contenir le SQL exécuté à l’étape 2 et la fonction doit être déployée avant que les statistiques puissent apparaître.

Le site démarre avec son contenu par défaut et des listes publiques vides. Les contenus enregistrés uniquement dans un ancien navigateur ne sont pas importés automatiquement : importe le fichier JSON depuis le panel après la configuration. Les demandes de contact sont partagées dans Supabase ; elles ne contiennent aucun secret d’administration. Le site étant statique, la limitation du formulaire réduit les abus courants mais ne remplace pas un CAPTCHA ou une protection anti-bot par adresse IP si le formulaire devient une cible de spam.

### Journal admin et statistiques de visite

Le journal consigne le compte administrateur, la date et les rubriques modifiées, sans conserver le contenu des champs. Les statistiques détaillées sont désactivées tant que le visiteur n’a pas accepté la bannière : elles utilisent son IP, une estimation ville/région/pays via IPWho, la page, le temps actif et le type d’appareil. L’IP est visible uniquement dans le panel admin et les événements sont purgés après 90 jours au prochain enregistrement statistique. La localisation déjà mesurée est réutilisée pour les pages suivantes afin de limiter les appels au service GeoIP. Les estimations de ville peuvent être incorrectes, notamment avec un VPN ou un réseau mobile. La page `privacy.html` présente l’information et permet de retirer le consentement. Supabase peut aussi traiter l’IP dans ses journaux techniques d’hébergement, indépendamment des statistiques. Complète et vérifie les mentions légales avant la mise en ligne.


## Soutien par virement direct

La page `soutenir.html` propose uniquement un virement bancaire lancé par le visiteur depuis sa propre banque. Elle ne traite pas les cartes et ne passe pas par un prestataire de paiement. Dans le panel, l’onglet « Soutien » permet de saisir un bénéficiaire, un IBAN, un BIC facultatif et un motif, puis d’activer ou non l’affichage public. Les coordonnées publiées sont visibles par tous les visiteurs. Tu peux aussi saisir un lien PayPal : le paiement passera alors par PayPal. La page ne confirme pas automatiquement les virements reçus.
