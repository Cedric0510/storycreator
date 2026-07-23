import { legalConfig } from "@/lib/legal";

export default function MentionsLegalesPage() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 18px", lineHeight: 1.6 }}>
      <h1>Mentions Legales</h1>
      <p>Derniere mise a jour: {legalConfig.updatedAt}</p>

      <h2>Editeur</h2>
      <p>
        Nom / Raison sociale: {legalConfig.publisherName}
        <br />
        Forme juridique: {legalConfig.legalForm}
        <br />
        Adresse: {legalConfig.publisherAddress}
        <br />
        Contact: {legalConfig.publisherContactEmail}
        <br />
        Telephone: {legalConfig.publisherContactPhone}
        <br />
        Directeur de publication: {legalConfig.publicationDirector}
      </p>

      <h2>Hebergement</h2>
      <p>
        Hebergeur applicatif: Vercel
        <br />
        Site:{" "}
        <a href="https://vercel.com" target="_blank" rel="noreferrer">
          https://vercel.com
        </a>
      </p>

      <h2>Fournisseurs techniques</h2>
      <p>
        Backend, base de données et stockage: infrastructure Cadarium auto-hébergée.
      </p>

      <h2>Propriete intellectuelle</h2>
      <p>
        Les contenus et elements du service sont proteges. Toute reproduction totale ou partielle
        sans autorisation prealable est interdite.
      </p>

      <h2>Contact juridique</h2>
      <p>{legalConfig.legalContactEmail}</p>
    </main>
  );
}
