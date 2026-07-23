export default function GuidePremierProjetPage() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 18px", lineHeight: 1.65 }}>
      <h1>Guide Pas a Pas: creer ton 1er projet</h1>
      <p>Version: beta auteur studio</p>

      <h2>0. Prerequis</h2>
      <ul>
        <li>Tu as un compte (reader/author/admin).</li>
        <li>
          Un admin t&apos;a passe au role <code>author</code> ou <code>admin</code> pour editer.
        </li>
        <li>
          Tu es connecté dans le bloc <code>Cadarium Cloud</code>.
        </li>
      </ul>

      <h2>1. Creer un nouveau projet</h2>
      <ol>
        <li>
          Clique <code>Nouveau projet</code> en haut.
        </li>
        <li>
          Dans <code>Projet</code>, remplis <code>Titre</code> et <code>Synopsis</code>.
        </li>
        <li>
          Le <code>Slug</code> se genere automatiquement (tu peux le modifier).
        </li>
      </ol>

      <h2>2. Definir les variables globales</h2>
      <ol>
        <li>
          Va dans <code>Variables globales</code>.
        </li>
        <li>
          Ajoute les stats utiles (ex: <code>energie</code>, <code>amitie_alice</code>).
        </li>
        <li>Renseigne la valeur initiale de chaque variable.</li>
      </ol>

      <h2>3. Creer les objets d&apos;histoire</h2>
      <ol>
        <li>
          Dans <code>Objets histoire</code>, saisis le nom de l&apos;objet.
        </li>
        <li>Ajoute une image.</li>
        <li>
          Clique <code>Ajouter</code> pour l&apos;enregistrer dans le projet.
        </li>
      </ol>

      <h2>4. Configurer la fiche hero</h2>
      <ol>
        <li>Remplis `Nom du heros` et `Lore du heros`.</li>
        <li>Ajoute les stats de base du hero.</li>
        <li>Ajoute son inventaire de depart si besoin.</li>
      </ol>

      <h2>5. Construire le graphe des blocs</h2>
      <ol>
        <li>
          Dans <code>Bibliotheque de blocs</code>, cree au minimum: titre + un bloc narratif.
        </li>
        <li>Clique un bloc dans le canvas pour ouvrir ses proprietes a droite.</li>
        <li>Relie les blocs entre eux en tirant les connexions (ou via les menus de cible).</li>
        <li>
          Definis un bloc de depart avec <code>Definir comme START</code>.
        </li>
      </ol>

      <h2>6. Exemple de structure minimale</h2>
      <ol>
        <li>
          Bloc <code>Ecran titre</code> vers bloc <code>Dialogue</code> vers bloc{" "}
          <code>Gameplay</code> vers bloc <code>Cinematique</code>.
        </li>
        <li>
          Dans <code>Dialogue</code>, cree les choix et leurs cibles.
        </li>
        <li>
          Dans <code>Gameplay</code>, place des zones cliquables et actions au clic.
        </li>
      </ol>

      <h2>7. Ajouter des assets correctement</h2>
      <ul>
        <li>
          Ajoute les images/videos/sons depuis les champs <code>file</code> des blocs.
        </li>
        <li>Apres ajout, verifie que l&apos;asset apparait dans l&apos;attachement du champ.</li>
        <li>Sauvegarde cloud pour pousser le JSON + references + assets.</li>
      </ul>

      <h2>8. Valider avant sauvegarde finale</h2>
      <ol>
        <li>
          Clique le bouton <code>Validation</code> (vert/jaune/rouge) dans la navbar, puis
          <code> Recontroler</code> dans la fenetre de validation si besoin.
        </li>
        <li>Corrige les erreurs (cibles manquantes, blocs non relies, etc.).</li>
        <li>Les warnings sont autorises, mais mieux vaut les traiter.</li>
      </ol>

      <h2>9. Sauvegarder et partager</h2>
      <ol>
        <li>
          Dans <code>Cadarium Cloud</code>, clique <code>Créer la sauvegarde</code> (première
          fois).
        </li>
        <li>
          Puis utilise <code>Sauvegarder cloud</code> apres chaque session.
        </li>
        <li>
          Owner/admin peut donner des droits dans <code>Droits cloud</code>.
        </li>
      </ol>

      <h2>10. Tester et exporter</h2>
      <ol>
        <li>
          Clique <code>Preview</code> pour tester le parcours.
        </li>
        <li>
          Clique <code>Export ZIP</code> pour generer JSON + dossier <code>assets</code>.
        </li>
        <li>Integre ce ZIP dans la partie lecteur Flutter pour test interne.</li>
      </ol>

      <h2>Checklist rapide avant livraison</h2>
      <ul>
        <li>Un seul bloc START clairement defini.</li>
        <li>Aucun bloc critique non relie.</li>
        <li>Choix de dialogue tous connectes.</li>
        <li>Assets presents et references valides.</li>
        <li>Sauvegarde cloud effectuee.</li>
      </ul>
    </main>
  );
}
