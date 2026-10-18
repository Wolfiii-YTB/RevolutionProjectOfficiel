# RV : RevolutionProject

Page de pré-ouverture en français pour RV : RevolutionProject. Le logo fourni est intégré en PNG transparent dans `assets/rv-logo.png`; l’accueil affiche une annonce mystérieuse et « ouverture prochaine » tant que le projet n’est pas ouvert. Une section présente Laélien, Corentin, la mission et la manière dont le projet veut avancer.

## Aperçu

Ouvre `index.html` ou publie le dépôt avec GitHub Pages. Le panneau d’administration est accessible sur `admin.html`. Il utilise le mot de passe fixe demandé pour le projet.

Le panneau admin est organisé en rubriques. Il permet d’éditer les textes de pré-ouverture, l’équipe et la mission, de préparer des pages, d’ajouter des projets avec tags et images, des avancées datées et illustrées, plusieurs progressions avec leurs étapes, ainsi que les points et textes du schéma sur l’accueil. La rubrique YouTube permet de renseigner le nom, le lien et la photo de profil de la chaîne, puis de gérer les liens vidéo : les directs sont affichés en premier, puis les vidéos mises en avant. Les aperçus utilisent les vignettes YouTube ; cliquer sur une vignette lance le lecteur sur le site web, ou ouvre YouTube directement si la page est lancée depuis un fichier local. Les annonces s’affichent sur `annonces.html`, le journal sur `devlogs.html`, les étapes sur `parcours.html` et les vidéos sur `videos.html`. La page `contact.html` propose un formulaire qui conserve une copie locale de la demande et prépare un e-mail dans la messagerie du visiteur. Les copies locales sont consultables dans l’onglet Contact de l’admin et exportables en JSON. Les images sont redimensionnées en WebP. Import/export inclut le contenu, les pages, les annonces, les devlogs, les vidéos, les progressions et le schéma. Tout est enregistré dans le navigateur utilisé.

Le thème passe automatiquement en sombre de 19 h à 9 h et en clair de 9 h à 19 h, selon l’heure locale. Le visiteur peut le changer manuellement; ce choix reste actif jusqu’au prochain changement automatique. Le lien « Connexion admin » en haut de la page ouvre l’écran de connexion.

## Limites de GitHub Pages

GitHub Pages héberge des fichiers statiques et ne fournit ni comptes utilisateurs, ni base de données pour sauvegarder les modifications. Le mot de passe est vérifié dans le navigateur à partir d’une empreinte, et une politique CSP limite les sources de scripts et de contenu. Cela réduit certains risques côté navigateur, mais ne crée pas une vraie frontière de sécurité : le code public peut être inspecté et le verrou d’interface contourné. N’utilise donc pas cet admin pour des informations confidentielles ni comme protection de données sensibles. Pour une vraie authentification, il faut déplacer la connexion et les écritures vers un backend privé.

L’accès admin, les changements et les copies de messages sont enregistrés dans le stockage local de **ce navigateur**. Le formulaire ouvre aussi la messagerie du visiteur pour qu’il envoie réellement le message. Une demande envoyée depuis un autre appareil ne peut pas apparaître dans l’inbox admin locale sans connecter un service externe (backend/formulaire hébergé). Les modifications restent enregistrées dans le navigateur utilisé.

Pour partager des modifications avec tous les visiteurs, exporte les données depuis l’admin et mets à jour les fichiers publiés dans le dépôt GitHub. Pour une vraie connexion et des modifications en ligne persistantes, il faudra connecter un backend ou un CMS avec authentification (par exemple un service de contenu hébergé).

La page Vidéos intègre les URL YouTube ajoutées dans l’administration. Les contenus marqués « Direct / livestream » apparaissent avant les vidéos classiques. Il faut ajouter manuellement le lien du direct ou du replay : sans clé API YouTube et sans backend, le site statique ne détecte pas automatiquement le démarrage d’un live ni les nouveaux uploads de la chaîne.

## Publication

1. Crée un dépôt GitHub et ajoute les fichiers du projet à sa racine.
2. Dans **Settings → Pages**, choisis **Deploy from a branch**, puis `main` et le dossier `/ (root)`.
3. Enregistre. GitHub Pages indiquera l’adresse publique du site.

Le site n’a pas besoin d’installation ou de compilation. Les animations respectent le réglage système « réduire les animations ».

Sur la page Progression, chaque étape publiée possède sa barre indépendante. Dans l’admin, tu peux en ajouter plusieurs, modifier le pourcentage et voir l’aperçu évoluer immédiatement. La barre globale reste visible : elle affiche la moyenne des pourcentages des étapes publiées (0 % s’il n’y en a pas encore).
