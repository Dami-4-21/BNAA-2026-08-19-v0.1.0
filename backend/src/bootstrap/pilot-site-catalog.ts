export const pilotSiteModulesByLegacyProject = {
  "BN-042": {
    "overview": {
      "weather": {
        "label": "Nuageux",
        "temperature": "22 deg",
        "wind": "19 km/h",
        "rainRisk": "15%",
        "source": "API meteo Tunisie - mock live"
      },
      "kpis": [
        {
          "label": "Conformite RJC",
          "value": "96%",
          "helper": "3 rapports incomplets sur 71 ce mois-ci",
          "tone": "success"
        },
        {
          "label": "FNC ouvertes",
          "value": "5",
          "helper": "2 critiques, 1 en validation MOE",
          "tone": "danger"
        },
        {
          "label": "Delai moyen de levee",
          "value": "3,4 j",
          "helper": "Moyenne 30 derniers jours",
          "tone": "warning"
        },
        {
          "label": "Derive planning",
          "value": "+2 j",
          "helper": "Lot structure en glissement cumule",
          "tone": "primary"
        }
      ]
    },
    "lotProgress": [
      {
        "lot": "Gros oeuvre",
        "task": "Voiles RDC",
        "progress": 74,
        "planned": 78,
        "owner": "Equipe structure",
        "tone": "primary"
      },
      {
        "lot": "VRD",
        "task": "Reseaux EU/EP",
        "progress": 62,
        "planned": 60,
        "owner": "Sous-traitant VRD",
        "tone": "success"
      },
      {
        "lot": "CVC",
        "task": "Reseaux facade nord",
        "progress": 38,
        "planned": 44,
        "owner": "Equipe fluides",
        "tone": "warning"
      },
      {
        "lot": "Second oeuvre",
        "task": "Preparation gaines",
        "progress": 29,
        "planned": 35,
        "owner": "Equipe second oeuvre",
        "tone": "danger"
      }
    ],
    "signatureQueue": [
      {
        "role": "Conducteur de travaux",
        "state": "Signe",
        "note": "Signature sur le rapport du 29/04 a 07:43",
        "tone": "success"
      },
      {
        "role": "Maitre d'oeuvre",
        "state": "En attente",
        "note": "Notification envoyee il y a 11 min",
        "tone": "warning"
      },
      {
        "role": "Archivage PDF",
        "state": "Pret",
        "note": "Generation automatique des validation MOE",
        "tone": "primary"
      }
    ],
    "incidentTemplates": [
      "Retard livraison materiaux",
      "Panne equipement",
      "Zone securite balisage",
      "Validation plan en attente"
    ],
    "photoLibrary": [
      {
        "id": "PH-301",
        "title": "Ferraillage cage A",
        "zone": "Niveau RDC",
        "lot": "Gros oeuvre",
        "task": "Voiles RDC",
        "time": "07:18",
        "timestamp": "2026-04-29T07:18:00",
        "geo": "36.8621, 10.1954",
        "author": "Nour Baccar",
        "accent": "from-sky-500/60 to-cyan-300/25"
      },
      {
        "id": "PH-302",
        "title": "Reseaux EP facade nord",
        "zone": "Sous-sol",
        "lot": "VRD",
        "task": "Reseaux EU/EP",
        "time": "09:42",
        "timestamp": "2026-04-29T09:42:00",
        "geo": "36.8624, 10.1951",
        "author": "Nour Baccar",
        "accent": "from-amber-400/55 to-orange-300/20"
      },
      {
        "id": "PH-303",
        "title": "Controle coffrage voile B2",
        "zone": "Axe B",
        "lot": "Gros oeuvre",
        "task": "Voiles RDC",
        "time": "11:07",
        "timestamp": "2026-04-29T11:07:00",
        "geo": "36.8620, 10.1958",
        "author": "Nour Baccar",
        "accent": "from-emerald-400/55 to-teal-300/20"
      },
      {
        "id": "PH-304",
        "title": "Cheminement gaines hall",
        "zone": "Bloc C",
        "lot": "CVC",
        "task": "Gaines hall",
        "time": "14:16",
        "timestamp": "2026-04-28T14:16:00",
        "geo": "36.8617, 10.1950",
        "author": "Hichem Trabelsi",
        "accent": "from-fuchsia-500/45 to-rose-300/20"
      }
    ],
    "ncrs": [
      {
        "ref": "NC-021",
        "title": "Epaisseur enrobage insuffisante",
        "owner": "Lot structure",
        "dueDate": "2026-05-01",
        "severity": "Critique",
        "status": "En cours",
        "tone": "danger",
        "photoAttached": true,
        "description": "Controle voile B2 : enrobage mesure a 2,1 cm au lieu de 3 cm sur zone haute."
      },
      {
        "ref": "NC-020",
        "title": "Absence etiquette sur lot gaines",
        "owner": "CVC",
        "dueDate": "2026-05-02",
        "severity": "Mineure",
        "status": "Planifiee",
        "tone": "warning",
        "photoAttached": false,
        "description": "Les gaines du bloc C sont posees sans etiquetage directionnel pour la maintenance."
      },
      {
        "ref": "NC-019",
        "title": "Photo de levee a confirmer",
        "owner": "Second oeuvre",
        "dueDate": "2026-04-30",
        "severity": "Majeure",
        "status": "Validation",
        "tone": "primary",
        "photoAttached": true,
        "description": "Levee proposee sur reserve peinture cage B, attente confirmation MOE."
      }
    ],
    "reports": [
      {
        "id": "RJC-2026-0429",
        "date": "2026-04-29",
        "weather": "Nuageux",
        "workforce": 46,
        "progress": 74,
        "author": "Nour Baccar",
        "status": "Soumis",
        "tone": "primary",
        "summary": "Beton voiles RDC coule, controle ferraillage valide.",
        "completeness": 100,
        "pdfReady": false,
        "signedByCt": true,
        "signedByMoe": false
      },
      {
        "id": "RJC-2026-0428",
        "date": "2026-04-28",
        "weather": "Ensoleille",
        "workforce": 43,
        "progress": 66,
        "author": "Nour Baccar",
        "status": "Signe",
        "tone": "success",
        "summary": "Reception ciment et mise a jour galerie photo facade est.",
        "completeness": 100,
        "pdfReady": true,
        "signedByCt": true,
        "signedByMoe": true
      },
      {
        "id": "RJC-2026-0427",
        "date": "2026-04-27",
        "weather": "Vent fort",
        "workforce": 38,
        "progress": 61,
        "author": "Nour Baccar",
        "status": "A completer",
        "tone": "warning",
        "summary": "Levage suspendu 2h, reprise l'apres-midi.",
        "completeness": 72,
        "pdfReady": false,
        "signedByCt": true,
        "signedByMoe": false
      }
    ],
    "reportDraft": {
      "reportDate": "29/04/2026",
      "weather": "Nuageux",
      "workforce": 46,
      "completedLots": [
        "Voiles RDC",
        "Reseaux EU/EP",
        "Ferraillage cage A"
      ],
      "blockers": "Attente validation detail acrottere facade nord.",
      "note": "Prioriser la diffusion du plan structure Rev.C avant la releve de demain."
    },
    "draftPhoto": {
      "title": "Point de controle facade ouest",
      "zone": "Facade ouest",
      "lot": "Gros oeuvre",
      "task": "Voiles RDC",
      "geo": "36.8623, 10.1952"
    },
    "draftNcr": {
      "title": "Fixation garde-corps incomplete",
      "owner": "Lot structure",
      "dueDate": "2026-05-03",
      "severity": "Majeure",
      "description": "Deux platines restent non scellees au niveau dalle haute bloc B.",
      "photoAttached": true
    }
  },
  "BN-039": {
    "overview": {
      "weather": {
        "label": "Ensoleille",
        "temperature": "24 deg",
        "wind": "14 km/h",
        "rainRisk": "5%",
        "source": "API meteo Tunisie - mock live"
      },
      "kpis": [
        {
          "label": "Conformite RJC",
          "value": "93%",
          "helper": "5 rapports incomplets sur 67 ce mois-ci",
          "tone": "warning"
        },
        {
          "label": "FNC ouvertes",
          "value": "3",
          "helper": "1 majeure sur les zones techniques",
          "tone": "warning"
        },
        {
          "label": "Delai moyen de levee",
          "value": "4,1 j",
          "helper": "Levee plus lente sur les interfaces fluides",
          "tone": "warning"
        },
        {
          "label": "Derive planning",
          "value": "+1 j",
          "helper": "Visa CVC encore attendu",
          "tone": "primary"
        }
      ]
    },
    "lotProgress": [
      {
        "lot": "Fluides",
        "task": "Reseaux CTA niveau 1",
        "progress": 51,
        "planned": 56,
        "owner": "Equipe CVC",
        "tone": "warning"
      },
      {
        "lot": "Electricite",
        "task": "Colonnes montantes",
        "progress": 47,
        "planned": 44,
        "owner": "Sous-traitant elec",
        "tone": "success"
      },
      {
        "lot": "Facade",
        "task": "Menuiseries bloc B",
        "progress": 38,
        "planned": 40,
        "owner": "Equipe facade",
        "tone": "primary"
      },
      {
        "lot": "Architecture",
        "task": "Cloisons zone consultation",
        "progress": 34,
        "planned": 37,
        "owner": "Second oeuvre",
        "tone": "danger"
      }
    ],
    "signatureQueue": [
      {
        "role": "Conducteur de travaux",
        "state": "Signe",
        "note": "Rapport du 30/04 signe a 08:11",
        "tone": "success"
      },
      {
        "role": "Maitre d'oeuvre",
        "state": "Signe",
        "note": "Validation MOE recue a 10:02",
        "tone": "success"
      },
      {
        "role": "Archivage PDF",
        "state": "Archive",
        "note": "PDF journalier stocke dans le dossier chantier",
        "tone": "primary"
      }
    ],
    "incidentTemplates": [
      "Visa CVC en attente",
      "Retard equipement technique",
      "Acces zone sterile a coordonner",
      "Point SECURITE a rebaliser"
    ],
    "photoLibrary": [
      {
        "id": "PH-401",
        "title": "Passage gaines CTA",
        "zone": "Bloc B - niveau 1",
        "lot": "Fluides",
        "task": "Reseaux CTA niveau 1",
        "time": "08:12",
        "timestamp": "2026-04-30T08:12:00",
        "geo": "36.8436, 10.2741",
        "author": "Meriem Kefi",
        "accent": "from-cyan-500/55 to-sky-300/20"
      },
      {
        "id": "PH-402",
        "title": "Colonnes montantes elec",
        "zone": "Noyau central",
        "lot": "Electricite",
        "task": "Colonnes montantes",
        "time": "10:33",
        "timestamp": "2026-04-30T10:33:00",
        "geo": "36.8432, 10.2745",
        "author": "Rym Ben Amor",
        "accent": "from-amber-400/55 to-orange-300/20"
      },
      {
        "id": "PH-403",
        "title": "Pose menuiseries facade",
        "zone": "Bloc B",
        "lot": "Facade",
        "task": "Menuiseries bloc B",
        "time": "14:08",
        "timestamp": "2026-04-29T14:08:00",
        "geo": "36.8434, 10.2738",
        "author": "Amine Gharbi",
        "accent": "from-emerald-400/55 to-teal-300/20"
      }
    ],
    "ncrs": [
      {
        "ref": "NC-108",
        "title": "Trappe technique mal repertee",
        "owner": "Lots techniques",
        "dueDate": "2026-05-02",
        "severity": "Majeure",
        "status": "En cours",
        "tone": "warning",
        "photoAttached": true,
        "description": "Repere non conforme entre plan EXE-CVC-014 et pose terrain dans le noyau B."
      },
      {
        "ref": "NC-107",
        "title": "Support chemin de cable a reprendre",
        "owner": "Electricite",
        "dueDate": "2026-05-04",
        "severity": "Mineure",
        "status": "Planifiee",
        "tone": "primary",
        "photoAttached": false,
        "description": "Deux supports restent a recaler avant fermeture du faux plafond."
      },
      {
        "ref": "NC-106",
        "title": "Etiquetage CTA incomplet",
        "owner": "CVC",
        "dueDate": "2026-04-30",
        "severity": "Mineure",
        "status": "Validation",
        "tone": "primary",
        "photoAttached": true,
        "description": "Le conducteur a propose la levee avec photo, en attente MOE."
      }
    ],
    "reports": [
      {
        "id": "RJC-2026-0390",
        "date": "2026-04-30",
        "weather": "Ensoleille",
        "workforce": 39,
        "progress": 45,
        "author": "Meriem Kefi",
        "status": "Signe",
        "tone": "success",
        "summary": "Coordination fluides/electricite realisee sur le bloc B.",
        "completeness": 100,
        "pdfReady": true,
        "signedByCt": true,
        "signedByMoe": true
      },
      {
        "id": "RJC-2026-0389",
        "date": "2026-04-29",
        "weather": "Nuageux",
        "workforce": 36,
        "progress": 42,
        "author": "Meriem Kefi",
        "status": "Soumis",
        "tone": "primary",
        "summary": "Pose gaines CTA et reprise des reservations en zone consultation.",
        "completeness": 96,
        "pdfReady": false,
        "signedByCt": true,
        "signedByMoe": false
      },
      {
        "id": "RJC-2026-0388",
        "date": "2026-04-28",
        "weather": "Vent fort",
        "workforce": 34,
        "progress": 39,
        "author": "Meriem Kefi",
        "status": "A completer",
        "tone": "warning",
        "summary": "Livraison equipements techniques partiellement reportee.",
        "completeness": 74,
        "pdfReady": false,
        "signedByCt": false,
        "signedByMoe": false
      }
    ],
    "reportDraft": {
      "reportDate": "30/04/2026",
      "weather": "Ensoleille",
      "workforce": 39,
      "completedLots": [
        "Passage gaines CTA niveau 1",
        "Colonnes montantes bloc B",
        "Pose menuiseries salle d'attente"
      ],
      "blockers": "Visa CVC lot fluides encore attendu pour zone consultation.",
      "note": "Prioriser l'envoi du plan technique Rev.C aux equipes terrain avant 18h."
    },
    "draftPhoto": {
      "title": "Controle faux plafond consultation",
      "zone": "Zone consultation",
      "lot": "Architecture",
      "task": "Cloisons zone consultation",
      "geo": "36.8433, 10.2740"
    },
    "draftNcr": {
      "title": "Repere gaine incorrect sur noyau B",
      "owner": "CVC",
      "dueDate": "2026-05-04",
      "severity": "Majeure",
      "description": "La gaine G-14 ne suit pas le repere revise sur la derniere diffusion EXE-CVC-014.",
      "photoAttached": true
    }
  },
  "BN-031": {
    "overview": {
      "weather": {
        "label": "Vent fort",
        "temperature": "20 deg",
        "wind": "28 km/h",
        "rainRisk": "12%",
        "source": "API meteo Tunisie - mock live"
      },
      "kpis": [
        {
          "label": "Conformite RJC",
          "value": "98%",
          "helper": "1 rapport incomplet sur 53 ce mois-ci",
          "tone": "success"
        },
        {
          "label": "FNC ouvertes",
          "value": "4",
          "helper": "2 sur l'etancheite du tablier",
          "tone": "danger"
        },
        {
          "label": "Delai moyen de levee",
          "value": "2,8 j",
          "helper": "Traitement rapide sur le lot ouvrages d'art",
          "tone": "success"
        },
        {
          "label": "Derive planning",
          "value": "+3 j",
          "helper": "Etancheite tablier a securiser avant recepissage",
          "tone": "danger"
        }
      ]
    },
    "lotProgress": [
      {
        "lot": "Ouvrages d'art",
        "task": "Etancheite tablier",
        "progress": 82,
        "planned": 87,
        "owner": "Equipe tablier",
        "tone": "danger"
      },
      {
        "lot": "Appuis",
        "task": "Reprise appareils d'appui",
        "progress": 91,
        "planned": 90,
        "owner": "Equipe structure",
        "tone": "success"
      },
      {
        "lot": "Drainage",
        "task": "Caniveaux lateraux",
        "progress": 76,
        "planned": 74,
        "owner": "VRD",
        "tone": "success"
      },
      {
        "lot": "Signalisation",
        "task": "Pre-signalisation provisoire",
        "progress": 58,
        "planned": 61,
        "owner": "Equipement routier",
        "tone": "warning"
      }
    ],
    "signatureQueue": [
      {
        "role": "Conducteur de travaux",
        "state": "Signe",
        "note": "Rapport ouvrage d'art signe a 06:58",
        "tone": "success"
      },
      {
        "role": "Maitre d'oeuvre",
        "state": "En attente",
        "note": "Validation attendue avant reunion hebdo de 17h",
        "tone": "warning"
      },
      {
        "role": "Archivage PDF",
        "state": "Pret",
        "note": "Archive automatique des que la contre-signature arrive",
        "tone": "primary"
      }
    ],
    "incidentTemplates": [
      "Vent fort sur tablier",
      "Blocage circulation chantier",
      "Controle appuis a revalider",
      "Betonage reporte"
    ],
    "photoLibrary": [
      {
        "id": "PH-501",
        "title": "Etancheite travée centrale",
        "zone": "Tablier - axe 3",
        "lot": "Ouvrages d'art",
        "task": "Etancheite tablier",
        "time": "06:40",
        "timestamp": "2026-04-30T06:40:00",
        "geo": "36.6802, 10.2913",
        "author": "Lotfi Dridi",
        "accent": "from-slate-500/55 to-zinc-300/20"
      },
      {
        "id": "PH-502",
        "title": "Controle appareils d'appui",
        "zone": "Pile P2",
        "lot": "Appuis",
        "task": "Reprise appareils d'appui",
        "time": "09:26",
        "timestamp": "2026-04-30T09:26:00",
        "geo": "36.6800, 10.2910",
        "author": "Walid Ben Romdhane",
        "accent": "from-orange-500/55 to-amber-300/20"
      },
      {
        "id": "PH-503",
        "title": "Caniveaux lateraux",
        "zone": "Rive sud",
        "lot": "Drainage",
        "task": "Caniveaux lateraux",
        "time": "13:44",
        "timestamp": "2026-04-29T13:44:00",
        "geo": "36.6804, 10.2916",
        "author": "Lotfi Dridi",
        "accent": "from-emerald-500/55 to-lime-300/20"
      }
    ],
    "ncrs": [
      {
        "ref": "NC-205",
        "title": "Reprise membrane tablier incomplete",
        "owner": "Ouvrages d'art",
        "dueDate": "2026-05-02",
        "severity": "Critique",
        "status": "En cours",
        "tone": "danger",
        "photoAttached": true,
        "description": "Deux zones de recouvrement restent sous tolerance sur la travée centrale."
      },
      {
        "ref": "NC-204",
        "title": "Joint de caniveau a reprendre",
        "owner": "Drainage",
        "dueDate": "2026-05-01",
        "severity": "Majeure",
        "status": "Validation",
        "tone": "primary",
        "photoAttached": true,
        "description": "Photo de levee transmise, controle MOE encore en attente."
      },
      {
        "ref": "NC-203",
        "title": "Balisage provisoire incomplet",
        "owner": "Signalisation",
        "dueDate": "2026-05-04",
        "severity": "Mineure",
        "status": "Planifiee",
        "tone": "warning",
        "photoAttached": false,
        "description": "Le balisage rive nord doit etre complete avant intervention nocturne."
      }
    ],
    "reports": [
      {
        "id": "RJC-2026-0319",
        "date": "2026-04-30",
        "weather": "Vent fort",
        "workforce": 52,
        "progress": 79,
        "author": "Lotfi Dridi",
        "status": "Soumis",
        "tone": "primary",
        "summary": "Controle etancheite tablier et reprise drainage rive sud.",
        "completeness": 98,
        "pdfReady": false,
        "signedByCt": true,
        "signedByMoe": false
      },
      {
        "id": "RJC-2026-0318",
        "date": "2026-04-29",
        "weather": "Nuageux",
        "workforce": 49,
        "progress": 77,
        "author": "Lotfi Dridi",
        "status": "Signe",
        "tone": "success",
        "summary": "Reprise appareils d'appui P2 finalisee.",
        "completeness": 100,
        "pdfReady": true,
        "signedByCt": true,
        "signedByMoe": true
      },
      {
        "id": "RJC-2026-0317",
        "date": "2026-04-28",
        "weather": "Ensoleille",
        "workforce": 47,
        "progress": 75,
        "author": "Lotfi Dridi",
        "status": "Signe",
        "tone": "success",
        "summary": "Pose caniveaux lateraux et controle signalisation provisoire.",
        "completeness": 100,
        "pdfReady": true,
        "signedByCt": true,
        "signedByMoe": true
      }
    ],
    "reportDraft": {
      "reportDate": "30/04/2026",
      "weather": "Vent fort",
      "workforce": 52,
      "completedLots": [
        "Etancheite travée centrale",
        "Controle appareils d'appui P2",
        "Caniveaux lateraux rive sud"
      ],
      "blockers": "Fenetre meteo a surveiller avant intervention de nuit sur signalisation.",
      "note": "Verifier la levee NC-205 avant cloture hebdomadaire."
    },
    "draftPhoto": {
      "title": "Controle rive nord",
      "zone": "Rive nord",
      "lot": "Signalisation",
      "task": "Pre-signalisation provisoire",
      "geo": "36.6801, 10.2915"
    },
    "draftNcr": {
      "title": "Recouvrement membrane a corriger",
      "owner": "Ouvrages d'art",
      "dueDate": "2026-05-02",
      "severity": "Critique",
      "description": "Le recouvrement de membrane reste insuffisant sur la travée centrale cote est.",
      "photoAttached": true
    }
  }
} as const;

export type PilotSiteModuleSeed = (typeof pilotSiteModulesByLegacyProject)[keyof typeof pilotSiteModulesByLegacyProject];

export function getPilotSiteModuleSeedByLegacyId(legacyProjectId: string) {
  const seed = pilotSiteModulesByLegacyProject[legacyProjectId as keyof typeof pilotSiteModulesByLegacyProject];
  return seed ? JSON.parse(JSON.stringify(seed)) as PilotSiteModuleSeed : null;
}
