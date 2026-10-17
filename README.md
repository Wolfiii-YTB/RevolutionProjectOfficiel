# RV : RevolutionProject

Page de pré-ouverture en français pour RV : RevolutionProject. Le logo fourni est intégré en PNG transparent dans `assets/rv-logo.png`; l’accueil affiche une annonce mystérieuse et « ouverture prochaine » tant que le projet n’est pas ouvert. Une section présente Laélien, Corentin, la mission et la manière dont le projet veut avancer.

## Aperçu

Ouvre `index.html` ou publie le dépôt avec GitHub Pages. Le panneau d’administration est accessible sur `admin.html`. Au premier accès, crée un mot de passe d’au moins 8 caractères.

Le panneau admin permet d’éditer les textes de pré-ouverture, les biographies de l’équipe et la mission, de préparer des pages, d’importer/exporter les données JSON et d’enregistrer les changements dans le navigateur. Les nouvelles pages restent cachées pendant la pré-ouverture. Le thème passe automatiquement en sombre de 19 h à 9 h et en clair de 9 h à 19 h, selon l’heure locale. Le visiteur peut le changer manuellement; ce choix reste actif jusqu’au prochain changement automatique. Le lien « Connexion admin » en haut de la page ouvre l’écran de connexion.

## Limites de GitHub Pages

GitHub Pages héberge des fichiers statiques et ne fournit ni comptes utilisateurs, ni base de données pour sauvegarder les modifications. L’accès admin et les changements sont enregistrés dans le stockage local de **ce navigateur**. Le mot de passe est un verrou d’interface, pas une protection de sécurité : une personne qui connaît l’URL peut contourner ce verrou ou lire le code du site. N’y stocke aucune information sensible. Effacer les données du site dans le navigateur réinitialise le mot de passe et les modifications locales.

Pour partager des modifications avec tous les visiteurs, exporte les données depuis l’admin et mets à jour les fichiers publiés dans le dépôt GitHub. Pour une vraie connexion et des modifications en ligne persistantes, il faudra connecter un backend ou un CMS avec authentification (par exemple un service de contenu hébergé).

## Publication

1. Crée un dépôt GitHub et ajoute les fichiers du projet à sa racine.
2. Dans **Settings → Pages**, choisis **Deploy from a branch**, puis `main` et le dossier `/ (root)`.
3. Enregistre. GitHub Pages indiquera l’adresse publique du site.

Le site n’a pas besoin d’installation ou de compilation. Il utilise Google Fonts pour les polices d’affichage.
