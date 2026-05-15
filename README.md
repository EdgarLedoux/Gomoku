# Gomoku — Paris × Ulaanbaatar 🖤⬜

Jeu de Gomoku multijoueur en ligne, codé en Python (Flask) + HTML/CSS/JS vanilla.  
Hébergé sur AlwaysData, communication temps réel via SSE (Server-Sent Events).

## Architecture

```
gomoku/
├── app.py              ← Serveur Flask (routes, logique, SSE)
├── wsgi.py             ← Point d'entrée pour AlwaysData (WSGI)
├── requirements.txt
├── templates/
│   ├── index.html      ← Page d'accueil (créer / rejoindre)
│   └── game.html       ← Page de jeu
└── static/
    ├── css/style.css   ← Design (thème bois japonais)
    └── js/game.js      ← Canvas, SSE client, interactions
```

## Lancer en local

```bash
git clone https://github.com/EdgarLedoux/gomoku.git
cd gomoku
python -m venv .venv
source .venv/bin/activate        # Windows : .venv\Scripts\activate
pip install -r requirements.txt
python app.py
# → http://localhost:5000
```

## Déployer sur AlwaysData

### 1. Préparer ton compte

1. Crée un compte sur [alwaysdata.com](https://www.alwaysdata.com)  
2. Note ton **nom de compte** (ex : `gomoku`)

### 2. Uploader les fichiers

Via SSH (recommandé) :
```bash
# Activer SSH dans : Administration → SSH → Activer
ssh tonpseudo@ssh-tonpseudo.alwaysdata.net
cd ~
git clone https://github.com/EdgarLedoux/gomoku.git
```

Ou via FTP (FileZilla) vers `/home/gomoku/gomoku/`.

### 3. Installer les dépendances

```bash
ssh gomoku@ssh-gomoku.alwaysdata.net
cd ~/gomoku
pip install -r requirements.txt --user
```

### 4. Modifier wsgi.py

Ouvre `wsgi.py` et remplace `<your_username>` par ton nom de compte AlwaysData.

### 5. Configurer le site dans l'admin

1. Va dans **Web → Sites → Ajouter un site**
2. **Type** : Python WSGI
3. **Répertoire de travail** : `/home/gomoku/gomoku`
4. **Fichier WSGI** : `wsgi.py`
5. **Python** : 3.11 (ou la dernière dispo)
6. Sauvegarde → ton jeu est en ligne sur `gomoku.alwaysdata.net`

## Comment jouer

1. Le joueur 1 ouvre le site → **Créer une partie** → reçoit un code (ex : `A1B2C3D4`)
2. Le joueur 2 ouvre le même site → **Rejoindre** → entre le code
3. La partie commence automatiquement
4. Les Noirs jouent en premier (joueur 1)

## Règles du Gomoku

- Plateau 15×15
- Les joueurs posent une pierre à tour de rôle
- Gagner = aligner **5 pierres** horizontalement, verticalement ou en diagonale
- Pas de règles avancées (pas de Renju) — variante classique

## Personnalisation

| Ce que tu veux changer | Où |
|---|---|
| Taille du plateau (15×15 → 19×19) | `BOARD_SIZE` dans `app.py` ET `game.js` |
| Alignement gagnant (5 → 6) | `WIN_LENGTH` dans `app.py` |
| Couleurs / design | `static/css/style.css` |
| Logique serveur | `app.py` |
| Rendu du plateau | `static/js/game.js` → `drawBoard()` |

## Limites connues (plan gratuit AlwaysData)

- **Pas de WebSockets** → on utilise SSE (Server-Sent Events), qui fonctionne très bien pour un jeu au tour par tour
- **État en mémoire** → si le serveur redémarre, les parties en cours sont perdues. Pour persister, ajouter une base SQLite (AlwaysData en propose une)
- **100 Mo de stockage** → largement suffisant

## Ajouter une base de données (optionnel)

AlwaysData propose MySQL et PostgreSQL. Pour remplacer le dict `games` en mémoire par SQLite :

```python
import sqlite3

def get_db():
    conn = sqlite3.connect("gomoku.db")
    conn.row_factory = sqlite3.Row
    return conn
```

Ouvre une issue ou un PR si tu veux cette feature !
