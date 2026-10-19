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

1. Dans Supabase, ouvre **SQL Editor**, colle le contenu de [`supabase/setup.sql`](supabase/setup.sql), puis exécute-le. Il crée les deux tables et leurs règles RLS : tout le monde peut lire le contenu public et envoyer un formulaire, mais seul un utilisateur connecté peut modifier le site ou lire/supprimer les demandes.
2. Dans **Authentication → Users**, crée un utilisateur administrateur avec ton adresse e-mail et le mot de passe souhaité. Dans les réglages d’authentification, désactive l’inscription publique. Ne crée aucun utilisateur public.
3. Publie les fichiers du dépôt sur GitHub Pages. Utilise l’adresse HTTPS du site ; l’authentification Supabase et les appels réseau ne fonctionnent pas en ouvrant directement les fichiers `file://`.
4. Connecte-toi sur `admin.html` avec l’adresse e-mail et le mot de passe du compte créé. Enregistre ou importe le contenu depuis ce panel : il sera alors visible par tous les visiteurs.

Le site démarre avec son contenu par défaut et des listes publiques vides. Les contenus enregistrés uniquement dans un ancien navigateur ne sont pas importés automatiquement : importe le fichier JSON depuis le panel après la configuration. Les demandes de contact sont partagées dans Supabase ; elles ne contiennent aucun secret d’administration.

