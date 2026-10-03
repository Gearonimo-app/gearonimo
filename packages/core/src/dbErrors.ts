/**
 * Vertaling van de foutmeldingen die de database zelf geeft (`raise exception`
 * in de migraties).
 *
 * Die teksten staan in het Nederlands in de SQL-functies. Een Engelse klant
 * zag ze dus letterlijk, bijvoorbeeld bij afvoeren of inloggen (controle
 * internationaal, Jos 2026-10-03). De Nederlandse tekst is hier de sleutel:
 * errorMessage() herkent hem en geeft de tekst in de taal van de app.
 *
 * Bewaakt door dbErrors.test.ts: die leest alle migraties en faalt zodra er
 * een melding in de database staat die hier ontbreekt. Een nieuwe
 * `raise exception` vraagt dus altijd ook om een regel hier.
 *
 * `%` = een waarde die de database invult (aantal, type); die gaat mee naar
 * de vertaling.
 */

export type ErrorLocale = "nl" | "en" | "fr" | "de";

type Translations = { en: string; fr: string; de: string };

export const DB_ERRORS: Record<string, Translations> = {
  "Aanvraag niet gevonden of niet van jouw keurbedrijf.": {
    en: "Request not found, or it does not belong to your inspection company.",
    fr: "Demande introuvable ou n'appartenant pas à votre société de contrôle.",
    de: "Anfrage nicht gefunden oder gehört nicht zu Ihrer Prüforganisation.",
  },
  "Alleen een afgeronde keuring kan gecorrigeerd worden.": {
    en: "Only a completed inspection can be corrected.",
    fr: "Seul un contrôle terminé peut être corrigé.",
    de: "Nur eine abgeschlossene Prüfung kann korrigiert werden.",
  },
  "Alleen een beheerder kan de materiaalsoorten wijzigen.": {
    en: "Only an administrator can change the equipment types.",
    fr: "Seul un administrateur peut modifier les types de matériel.",
    de: "Nur ein Administrator kann die Materialarten ändern.",
  },
  "Alleen een beheerder kan medewerkers beheren.": {
    en: "Only an administrator can manage users.",
    fr: "Seul un administrateur peut gérer les utilisateurs.",
    de: "Nur ein Administrator kann Benutzer verwalten.",
  },
  "Alleen een beheerder mag bedrijfsgegevens aanpassen.": {
    en: "Only an administrator can change the company details.",
    fr: "Seul un administrateur peut modifier les informations de l'entreprise.",
    de: "Nur ein Administrator kann die Firmendaten ändern.",
  },
  "Alleen een beheerder mag materiaal aanpassen.": {
    en: "Only an administrator can change equipment.",
    fr: "Seul un administrateur peut modifier le matériel.",
    de: "Nur ein Administrator kann Material ändern.",
  },
  "Alleen een beheerder van een klant kan een keuring aanvragen.": {
    en: "Only a customer administrator can request an inspection.",
    fr: "Seul un administrateur du client peut demander un contrôle.",
    de: "Nur ein Administrator des Kunden kann eine Prüfung anfordern.",
  },
  "Alleen een catalogusbeheerder mag dit opvragen.": {
    en: "Only a catalogue manager can request this.",
    fr: "Seul un gestionnaire du catalogue peut consulter ceci.",
    de: "Nur ein Katalogverwalter darf dies abfragen.",
  },
  "Alleen een catalogusbeheerder mag een product verwijderen.": {
    en: "Only a catalogue manager can delete a product.",
    fr: "Seul un gestionnaire du catalogue peut supprimer un produit.",
    de: "Nur ein Katalogverwalter darf ein Produkt löschen.",
  },
  "Alleen een keurmeester kan een klant aanmaken.": {
    en: "Only an inspector can create a customer.",
    fr: "Seul un contrôleur peut créer un client.",
    de: "Nur ein Prüfer kann einen Kunden anlegen.",
  },
  "Artikel niet gevonden bij jouw bedrijf.": {
    en: "Item not found in your company.",
    fr: "Article introuvable dans votre entreprise.",
    de: "Artikel in Ihrem Unternehmen nicht gefunden.",
  },
  'Artikel niet gevonden, of "in gebruik sinds" is al ingevuld.': {
    en: 'Item not found, or "in use since" has already been filled in.',
    fr: "Article introuvable, ou « en service depuis » est déjà renseigné.",
    de: "Artikel nicht gefunden, oder „in Gebrauch seit“ ist bereits ausgefüllt.",
  },
  "Artikel niet gevonden, of het wordt door een keurbedrijf gekeurd.": {
    en: "Item not found, or it is inspected by an inspection company.",
    fr: "Article introuvable, ou il est contrôlé par une société de contrôle.",
    de: "Artikel nicht gefunden, oder er wird von einer Prüforganisation geprüft.",
  },
  "Artikel niet gevonden.": {
    en: "Item not found.",
    fr: "Article introuvable.",
    de: "Artikel nicht gefunden.",
  },
  "De datum kan niet in de toekomst liggen.": {
    en: "The date cannot be in the future.",
    fr: "La date ne peut pas être dans le futur.",
    de: "Das Datum darf nicht in der Zukunft liegen.",
  },
  "Deze gebruiker hoort niet bij deze klant.": {
    en: "This user does not belong to this customer.",
    fr: "Cet utilisateur n'appartient pas à ce client.",
    de: "Dieser Benutzer gehört nicht zu diesem Kunden.",
  },
  "Deze materiaalsoort bevat nog % artikel(en); voer die eerst af.": {
    en: "This equipment type still contains % item(s); retire them first.",
    fr: "Ce type de matériel contient encore % article(s) ; retirez-les d'abord.",
    de: "Diese Materialart enthält noch % Artikel; mustern Sie diese zuerst aus.",
  },
  "Dit account is al aan een keurmeester gekoppeld.": {
    en: "This account is already linked to an inspector.",
    fr: "Ce compte est déjà lié à un contrôleur.",
    de: "Dieses Konto ist bereits mit einem Prüfer verknüpft.",
  },
  "Dit account is al aan een klant gekoppeld.": {
    en: "This account is already linked to a customer.",
    fr: "Ce compte est déjà lié à un client.",
    de: "Dieses Konto ist bereits mit einem Kunden verknüpft.",
  },
  "Dit account is geen keurmeester-account. Vraag je beheerder om toegang.": {
    en: "This account is not an inspector account. Ask your administrator for access.",
    fr: "Ce compte n'est pas un compte contrôleur. Demandez l'accès à votre administrateur.",
    de: "Dieses Konto ist kein Prüferkonto. Bitten Sie Ihren Administrator um Zugang.",
  },
  "Dit is de laatste beheerder van dit keurbedrijf. Maak eerst een andere keurmeester beheerder.": {
    en: "This is the last administrator of this inspection company. Make another inspector administrator first.",
    fr: "C'est le dernier administrateur de cette société de contrôle. Nommez d'abord un autre contrôleur administrateur.",
    de: "Dies ist der letzte Administrator dieser Prüforganisation. Machen Sie zuerst einen anderen Prüfer zum Administrator.",
  },
  "Een afgeronde keuring kan niet meer gewijzigd worden. Gebruik correct_inspection() om te corrigeren.": {
    en: "A completed inspection can no longer be changed. Make a correction instead.",
    fr: "Un contrôle terminé ne peut plus être modifié. Effectuez plutôt une correction.",
    de: "Eine abgeschlossene Prüfung kann nicht mehr geändert werden. Erstellen Sie stattdessen eine Korrektur.",
  },
  "Een afgeronde keuring kan niet verwijderd worden. Gebruik correct_inspection() om te corrigeren.": {
    en: "A completed inspection cannot be deleted. Make a correction instead.",
    fr: "Un contrôle terminé ne peut pas être supprimé. Effectuez plutôt une correction.",
    de: "Eine abgeschlossene Prüfung kann nicht gelöscht werden. Erstellen Sie stattdessen eine Korrektur.",
  },
  // Huidige teksten van de onveranderlijkheids-triggers (20260766, 24 sept.);
  // de varianten met correct_inspection() hierboven zijn van 20260917.
  "Een afgeronde keuring kan niet meer gewijzigd worden. Maak een nieuwe keuring aan.": {
    en: "A completed inspection can no longer be changed. Start a new inspection.",
    fr: "Un contrôle terminé ne peut plus être modifié. Créez un nouveau contrôle.",
    de: "Eine abgeschlossene Prüfung kann nicht mehr geändert werden. Legen Sie eine neue Prüfung an.",
  },
  "Een afgeronde keuring kan niet verwijderd worden. Maak een nieuwe keuring aan.": {
    en: "A completed inspection cannot be deleted. Start a new inspection.",
    fr: "Un contrôle terminé ne peut pas être supprimé. Créez un nouveau contrôle.",
    de: "Eine abgeschlossene Prüfung kann nicht gelöscht werden. Legen Sie eine neue Prüfung an.",
  },
  "Items van een afgeronde keuring kunnen niet meer gewijzigd worden. Maak een nieuwe keuring aan.": {
    en: "Items of a completed inspection can no longer be changed. Start a new inspection.",
    fr: "Les articles d'un contrôle terminé ne peuvent plus être modifiés. Créez un nouveau contrôle.",
    de: "Positionen einer abgeschlossenen Prüfung können nicht mehr geändert werden. Legen Sie eine neue Prüfung an.",
  },
  "Het certificaat van een afgeronde keuring kan niet meer gewijzigd of verwijderd worden. Maak een nieuwe keuring aan.": {
    en: "The certificate of a completed inspection can no longer be changed or deleted. Start a new inspection.",
    fr: "Le certificat d'un contrôle terminé ne peut plus être modifié ni supprimé. Créez un nouveau contrôle.",
    de: "Das Zertifikat einer abgeschlossenen Prüfung kann nicht mehr geändert oder gelöscht werden. Legen Sie eine neue Prüfung an.",
  },
  "Geen gewijzigde artikelen om te corrigeren.": {
    en: "No changed items to correct.",
    fr: "Aucun article modifié à corriger.",
    de: "Keine geänderten Artikel zu korrigieren.",
  },
  "Een of meer artikelen horen niet bij deze keuring (of staan er dubbel in).": {
    en: "One or more items do not belong to this inspection (or appear twice).",
    fr: "Un ou plusieurs articles n'appartiennent pas à ce contrôle (ou y figurent deux fois).",
    de: "Ein oder mehrere Artikel gehören nicht zu dieser Prüfung (oder sind doppelt enthalten).",
  },
  "Een of meer artikelen zijn al gecorrigeerd. Corrigeer ze vanaf het nieuwste certificaat.": {
    en: "One or more items have already been corrected. Correct them from the latest certificate.",
    fr: "Un ou plusieurs articles ont déjà été corrigés. Corrigez-les à partir du certificat le plus récent.",
    de: "Ein oder mehrere Artikel wurden bereits korrigiert. Korrigieren Sie sie über das neueste Zertifikat.",
  },
  "Onbekende uitnodigingscode.": {
    en: "Unknown invitation code.",
    fr: "Code d'invitation inconnu.",
    de: "Unbekannter Einladungscode.",
  },
  "Dit account is een klant-account, geen keurmeester-account.": {
    en: "This account is a customer account, not an inspector account.",
    fr: "Ce compte est un compte client, pas un compte contrôleur.",
    de: "Dieses Konto ist ein Kundenkonto, kein Prüferkonto.",
  },
  "Alleen afgekeurd materiaal kan hier afgevoerd worden -- neem voor ander materiaal contact op met je keurmeester.": {
    en: "Only rejected equipment can be retired here -- for other equipment, contact your inspector.",
    fr: "Seul le matériel refusé peut être retiré ici -- pour le reste, contactez votre contrôleur.",
    de: "Hier kann nur abgelehntes Material ausgemustert werden -- für anderes Material wenden Sie sich an Ihren Prüfer.",
  },
  "Alleen een beheerder mag materiaal afvoeren.": {
    en: "Only an administrator can retire equipment.",
    fr: "Seul un administrateur peut retirer du matériel.",
    de: "Nur ein Administrator darf Material ausmustern.",
  },
  "Een controle kan niet in de toekomst liggen.": {
    en: "A check cannot be in the future.",
    fr: "Une vérification ne peut pas être dans le futur.",
    de: "Eine Kontrolle darf nicht in der Zukunft liegen.",
  },
  "Een geïmporteerde keuring heeft geen eigen certificaat en kan niet gecorrigeerd worden.": {
    en: "An imported inspection has no certificate of its own and cannot be corrected.",
    fr: "Un contrôle importé n'a pas de certificat propre et ne peut pas être corrigé.",
    de: "Eine importierte Prüfung hat kein eigenes Zertifikat und kann nicht korrigiert werden.",
  },
  "Eén of meer artikelen horen niet bij jouw bedrijf.": {
    en: "One or more items do not belong to your company.",
    fr: "Un ou plusieurs articles n'appartiennent pas à votre entreprise.",
    de: "Ein oder mehrere Artikel gehören nicht zu Ihrem Unternehmen.",
  },
  "Geen actieve keurmeester bij dit keurbedrijf.": {
    en: "No active inspector at this inspection company.",
    fr: "Aucun contrôleur actif dans cette société de contrôle.",
    de: "Kein aktiver Prüfer bei dieser Prüforganisation.",
  },
  "Geen certificaat gevonden voor de oorspronkelijke keuring.": {
    en: "No certificate found for the original inspection.",
    fr: "Aucun certificat trouvé pour le contrôle d'origine.",
    de: "Kein Zertifikat für die ursprüngliche Prüfung gefunden.",
  },
  "Geen klantkoppeling voor dit account.": {
    en: "This account is not linked to a customer.",
    fr: "Ce compte n'est lié à aucun client.",
    de: "Dieses Konto ist mit keinem Kunden verknüpft.",
  },
  "Geen toegang tot deze keuring.": {
    en: "No access to this inspection.",
    fr: "Pas d'accès à ce contrôle.",
    de: "Kein Zugriff auf diese Prüfung.",
  },
  "Geen toegang tot dit klantbedrijf.": {
    en: "No access to this customer.",
    fr: "Pas d'accès à ce client.",
    de: "Kein Zugriff auf diesen Kunden.",
  },
  "Het certificaat van een afgeronde keuring kan niet meer gewijzigd of verwijderd worden. Gebruik correct_inspection() om te corrigeren.": {
    en: "The certificate of a completed inspection can no longer be changed or deleted. Make a correction instead.",
    fr: "Le certificat d'un contrôle terminé ne peut plus être modifié ni supprimé. Effectuez plutôt une correction.",
    de: "Das Zertifikat einer abgeschlossenen Prüfung kann nicht mehr geändert oder gelöscht werden. Erstellen Sie stattdessen eine Korrektur.",
  },
  "Hoofdartikel niet gevonden bij dit klantbedrijf.": {
    en: "Main item not found for this customer.",
    fr: "Article principal introuvable chez ce client.",
    de: "Hauptartikel bei diesem Kunden nicht gefunden.",
  },
  "Items van een afgeronde keuring kunnen niet meer gewijzigd worden. Gebruik correct_inspection() om te corrigeren.": {
    en: "Items of a completed inspection can no longer be changed. Make a correction instead.",
    fr: "Les articles d'un contrôle terminé ne peuvent plus être modifiés. Effectuez plutôt une correction.",
    de: "Positionen einer abgeschlossenen Prüfung können nicht mehr geändert werden. Erstellen Sie stattdessen eine Korrektur.",
  },
  "Items van een afgeronde keuring kunnen niet verwijderd worden.": {
    en: "Items of a completed inspection cannot be deleted.",
    fr: "Les articles d'un contrôle terminé ne peuvent pas être supprimés.",
    de: "Positionen einer abgeschlossenen Prüfung können nicht gelöscht werden.",
  },
  "Je kunt alleen je eigen spullen afvoeren. Vraag de beheerder.": {
    en: "You can only retire your own equipment. Ask the administrator.",
    fr: "Vous ne pouvez retirer que votre propre matériel. Demandez à l'administrateur.",
    de: "Sie können nur Ihr eigenes Material ausmustern. Fragen Sie den Administrator.",
  },
  "Je kunt jezelf niet inactief of niet-beheerder maken.": {
    en: "You cannot make yourself inactive or remove your own administrator rights.",
    fr: "Vous ne pouvez pas vous rendre inactif ni retirer vos propres droits d'administrateur.",
    de: "Sie können sich nicht selbst deaktivieren oder Ihre eigenen Administratorrechte entfernen.",
  },
  "Keuring niet gevonden.": {
    en: "Inspection not found.",
    fr: "Contrôle introuvable.",
    de: "Prüfung nicht gefunden.",
  },
  "Kies een datum.": {
    en: "Choose a date.",
    fr: "Choisissez une date.",
    de: "Wählen Sie ein Datum.",
  },
  "Kies een product uit de catalogus of vul een omschrijving in.": {
    en: "Choose a product from the catalogue or enter a description.",
    fr: "Choisissez un produit du catalogue ou saisissez une description.",
    de: "Wählen Sie ein Produkt aus dem Katalog oder geben Sie eine Beschreibung ein.",
  },
  "Kies minstens één artikel.": {
    en: "Choose at least one item.",
    fr: "Choisissez au moins un article.",
    de: "Wählen Sie mindestens einen Artikel.",
  },
  "Lege base voor certificaatnummer.": {
    en: "Empty base for the certificate number.",
    fr: "Base vide pour le numéro de certificat.",
    de: "Leere Basis für die Zertifikatsnummer.",
  },
  "Medewerker niet gevonden bij jouw bedrijf.": {
    en: "User not found in your company.",
    fr: "Utilisateur introuvable dans votre entreprise.",
    de: "Benutzer in Ihrem Unternehmen nicht gefunden.",
  },
  "Naam is verplicht.": {
    en: "Name is required.",
    fr: "Le nom est obligatoire.",
    de: "Name ist erforderlich.",
  },
  "Niet ingelogd.": {
    en: "Not logged in.",
    fr: "Non connecté.",
    de: "Nicht angemeldet.",
  },
  "Nieuw artikel niet gevonden bij dit klantbedrijf.": {
    en: "New item not found for this customer.",
    fr: "Nouvel article introuvable chez ce client.",
    de: "Neuer Artikel bei diesem Kunden nicht gefunden.",
  },
  "Onbekend catalogusproduct.": {
    en: "Unknown catalogue product.",
    fr: "Produit du catalogue inconnu.",
    de: "Unbekanntes Katalogprodukt.",
  },
  "Onbekend keurbedrijf.": {
    en: "Unknown inspection company.",
    fr: "Société de contrôle inconnue.",
    de: "Unbekannte Prüforganisation.",
  },
  "Onbekend producttype: %": {
    en: "Unknown product type: %",
    fr: "Type de produit inconnu : %",
    de: "Unbekannter Produkttyp: %",
  },
  "Onbekende of al gebruikte uitnodigingscode.": {
    en: "Unknown or already used invitation code.",
    fr: "Code d'invitation inconnu ou déjà utilisé.",
    de: "Unbekannter oder bereits verwendeter Einladungscode.",
  },
  "Te veel mislukte pogingen. Probeer het over een uur opnieuw.": {
    en: "Too many failed attempts. Try again in an hour.",
    fr: "Trop de tentatives échouées. Réessayez dans une heure.",
    de: "Zu viele fehlgeschlagene Versuche. Versuchen Sie es in einer Stunde erneut.",
  },
  "Te vervangen artikel niet gevonden bij dit klantbedrijf.": {
    en: "Item to be replaced not found for this customer.",
    fr: "Article à remplacer introuvable chez ce client.",
    de: "Zu ersetzender Artikel bei diesem Kunden nicht gefunden.",
  },
  "Terugzetten kan alleen door wie het afvoerde, of door de beheerder.": {
    en: "Only the person who retired it, or the administrator, can restore it.",
    fr: "Seule la personne qui l'a retiré, ou l'administrateur, peut le restaurer.",
    de: "Nur wer es ausgemustert hat, oder der Administrator, kann es wiederherstellen.",
  },
  "Uitnodigingscodes zijn vervallen. Vraag je beheerder om je e-mailadres op de lijst Gebruikers te zetten en log daarmee in.": {
    en: "Invitation codes are no longer used. Ask your administrator to add your email address to the Users list, then log in with it.",
    fr: "Les codes d'invitation ne sont plus utilisés. Demandez à votre administrateur d'ajouter votre adresse e-mail à la liste Utilisateurs, puis connectez-vous avec.",
    de: "Einladungscodes werden nicht mehr verwendet. Bitten Sie Ihren Administrator, Ihre E-Mail-Adresse in die Benutzerliste aufzunehmen, und melden Sie sich damit an.",
  },
};

// Nederlandse tekst → patroon; `%` wordt een vangst voor de ingevulde waarde.
const PATTERNS: { re: RegExp; t: Translations }[] = Object.entries(DB_ERRORS).map(([nl, t]) => ({
  re: new RegExp("^" + nl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, "(.+?)") + "$"),
  t,
}));

/** De databasemelding in de gevraagde taal; onbekende meldingen en
 * Nederlands ongewijzigd. */
export function translateDbError(message: string, locale: ErrorLocale): string {
  if (locale === "nl") return message;
  const text = message.trim();
  for (const { re, t } of PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    let i = 1;
    return t[locale].replace(/%/g, () => m[i++] ?? "");
  }
  return message;
}

// De app-taal; de apps zetten dit bij het opstarten (main.ts), zodat
// errorMessage() overal de juiste taal geeft zonder dat elke aanroeper die
// hoeft mee te geven.
let currentLocale: () => ErrorLocale = () => "nl";
export function setErrorLocale(getLocale: () => string): void {
  currentLocale = () => {
    const l = getLocale();
    return l === "en" || l === "fr" || l === "de" ? l : "nl";
  };
}
export function errorLocale(): ErrorLocale {
  return currentLocale();
}
