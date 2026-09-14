"use client"

import { createContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { getLSItem, setLSItem, clearLS } from '../utils/localStorageManager';
import { useAuth } from '@clerk/nextjs';

export const AiAdminContext = createContext({});

// Compteur monotone pour des _id temporaires uniques : deux créations dans la même
// milliseconde produisaient le même 'temp_<ms>', et la réconciliation optimiste
// (qui remplaçait *tout* item temp_) en perdait alors une.
let tempIdCounter = 0;
const nextTempId = () => `temp_${Date.now()}_${++tempIdCounter}`;

/**
 * Hook-factory CRUD partagé par élèves / enseignants / classes : ces trois
 * ressources avaient exactement la même logique (fetch + cache LocalStorage,
 * save optimiste avec _id temporaire puis réconciliation serveur, delete
 * optimiste avec re-fetch en cas d'échec). Seuls le segment de route — qui sert
 * aussi de clé LS — et le setter d'état changeaient.
 *
 * Appelé une fois par ressource au niveau racine du Provider (jamais en boucle
 * ni conditionnellement) : l'ordre des hooks reste donc stable, comme trois
 * hooks personnalisés distincts.
 *
 * @param {string} resource - 'eleves' | 'enseignants' | 'classes' (route + clé LS)
 * @param {Function} setList - setter d'état de la liste
 * @param {Function} setLoaded - setter du flag "chargé"
 * @param {Function} setSelected - setter de l'élément sélectionné (partagé)
 */
const useResourceCrud = (resource, setList, setLoaded, setSelected) => {
  const url = `/api/school_ai/${resource}`;

  const fetchList = useCallback(async (bypassCache = false) => {
    try {
      console.log(`[FRONTEND STORE] 🔄 fetchList('${resource}') déclenché (bypassCache: ${bypassCache})`);
      let data = !bypassCache ? getLSItem(resource) : null;
      if (data && Array.isArray(data) && data.length > 0) {
        console.log(`[FRONTEND STORE] 📦 '${resource}' chargé depuis LocalStorage (nombre: ${data.length})`);
        setList(data);
      } else {
        console.log(`[FRONTEND STORE] 🌐 Récupération API: GET ${url}`);
        const res = await fetch(url);
        console.log(`[FRONTEND STORE] 📡 Réponse HTTP ${url}: status ${res.status}`);
        if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
        data = await res.json();
        console.log(`[FRONTEND STORE] 📥 Données reçues pour '${resource}':`, { isArray: Array.isArray(data), length: Array.isArray(data) ? data.length : 'N/A', raw: data });
        if (Array.isArray(data)) {
          setList(data);
          setLSItem(resource, data);
        } else {
          console.error(`[FRONTEND STORE] ❌ Données non-tableau reçues pour ${resource}:`, data);
          setList([]);
        }
      }
    } catch (err) {
      console.error(`[FRONTEND STORE] ❌ Erreur fetch ${resource}:`, err);
    } finally {
      setLoaded(true);
    }
  }, [resource, url, setList, setLoaded]);

  const save = useCallback(async (data) => {
    const method = data._id ? 'PUT' : 'POST';
    const tempId = data._id ? null : nextTempId();

    // Mise à jour optimiste
    setList(prev => {
      let newList;
      if (data._id) {
        newList = prev.map(it => it._id === data._id ? { ...it, ...data } : it);
      } else {
        newList = [...prev, { ...data, _id: tempId }];
      }
      setLSItem(resource, newList);
      return newList;
    });

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Request failed');
      const saved = await res.json();

      // Réconciliation finale avec les données serveur (IDs réels, timestamps…)
      setList(prev => {
        const newList = prev.map(it => (it._id === saved._id || it._id === tempId) ? saved : it);
        // Supprimer tout doublon temporaire si c'était une création
        const uniqueList = Array.from(new Map(newList.map(item => [item._id, item])).values());
        setLSItem(resource, uniqueList);
        return uniqueList;
      });

      // Mettre à jour 'selected' si c'est l'élément actuellement sélectionné
      setSelected(prev => (prev && prev._id === saved._id) ? saved : prev);

      return saved;
    } catch (err) {
      console.error(`Erreur save ${resource}, annulation mise à jour optimiste`, err);
      // Forcer un rechargement propre en cas d'erreur
      const res = await fetch(url, { cache: 'no-store' });
      const freshData = await res.json();
      setList(freshData);
      setLSItem(resource, freshData);
      throw err;
    }
  }, [resource, url, setList, setSelected]);

  const remove = useCallback(async (_id) => {
    // Optimistic Update
    setList(prev => {
      const newList = prev.filter(it => it._id !== _id);
      setLSItem(resource, newList);
      return newList;
    });

    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _id }),
      });

      if (!res.ok) throw new Error('Request failed');

      const updated = await fetch(url);
      const newList = await updated.json();
      setList(newList);
      setLSItem(resource, newList);
    } catch (err) {
      console.error(`Optimistic UI revert for delete ${resource}`, err);
      await fetchList();
      throw err;
    }
  }, [resource, url, setList, fetchList]);

  return { fetchList, save, remove };
};

export const AdminContextProvider = ({ children }) => {
  const { userId } = useAuth();

  // States
  const [eleves, setEleves] = useState([]);
  const [elevesLoaded, setElevesLoaded] = useState(false);
  const [enseignants, setEnseignants] = useState([]);
  const [enseignantsLoaded, setEnseignantsLoaded] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editType, setEditType] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [dynamicSubjects, setDynamicSubjects] = useState([]);
  const [subjectsLoaded, setSubjectsLoaded] = useState(false);

  // --- DYNAMIC FEES CONFIGURATION ---
  const [feeDefinitions, setFeeDefinitions] = useState([]);
  const [feeDefinitionsLoaded, setFeeDefinitionsLoaded] = useState(false);

  // --- DYNAMIC TARGETS PROFILING ---
  const [targetDefinitions, setTargetDefinitions] = useState([]);
  const [targetDefinitionsLoaded, setTargetDefinitionsLoaded] = useState(false);

  // --- HOMEPAGE CONFIGURATION ---
  const [homepage, setHomepage] = useState({ title: '', texts: [], photo: '' });
  const [homepageLoaded, setHomepageLoaded] = useState(false);

  // LS keys canoniques
  const FEE_DEFINITIONS_LS_KEY = 'school_fee_definitions';
  const TARGET_DEFINITIONS_LS_KEY = 'school_target_definitions';
  const HOMEPAGE_LS_KEY = 'school_homepage';

  // Normalize legacy entries ({ argent, riz }) to new dynamic format
  const normalizeFeeItem = useCallback((item) => {
    if (!item) return null;
    const LEGACY_FEE_MAP = { argent: 'scol_cash', riz: 'scol_nature' };
    const legacyKey = Object.keys(LEGACY_FEE_MAP).find(key => item[key] !== undefined);
    if (legacyKey) {
      return {
        feeId: LEGACY_FEE_MAP[legacyKey],
        amount: Number(item[legacyKey]),
        timestamp: item.timestamp || Date.now()
      };
    }
    return item; // Already new format
  }, []);

  // Fetch fee definitions + target definitions: LS first, then BD
  const fetchSchoolSettings = useCallback(async (bypassCache = false) => {
    // Try LS cache for fees
    const cachedFees = !bypassCache ? getLSItem(FEE_DEFINITIONS_LS_KEY) : null;
    if (cachedFees && Array.isArray(cachedFees) && cachedFees.length > 0) {
      setFeeDefinitions(cachedFees);
      setFeeDefinitionsLoaded(true);
    }
    // Try LS cache for targets
    const cachedTargets = !bypassCache ? getLSItem(TARGET_DEFINITIONS_LS_KEY) : null;
    if (cachedTargets && Array.isArray(cachedTargets) && cachedTargets.length > 0) {
      setTargetDefinitions(cachedTargets);
      setTargetDefinitionsLoaded(true);
    }
    // Try LS cache for homepage
    const cachedHomepage = !bypassCache ? getLSItem(HOMEPAGE_LS_KEY) : null;
    if (cachedHomepage && typeof cachedHomepage === 'object' && cachedHomepage.title) {
        setHomepage(cachedHomepage);
        setHomepageLoaded(true);
    }

    // If all are cached, skip API call
    if (!bypassCache && cachedFees?.length > 0 && cachedTargets?.length > 0 && cachedHomepage?.title) return;

    try {
      const res = await fetch('/api/school_ai/ecole');
      if (res.ok) {
        const data = await res.json();
        const defs = data.feeDefinitions ?? [];
        if (Array.isArray(defs) && defs.length > 0) {
          setFeeDefinitions(defs);
          setLSItem(FEE_DEFINITIONS_LS_KEY, defs);
        } else {
          setFeeDefinitions([]);
        }
        const tgts = data.targets ?? [];
        if (Array.isArray(tgts) && tgts.length > 0) {
          setTargetDefinitions(tgts);
          setLSItem(TARGET_DEFINITIONS_LS_KEY, tgts);
        } else {
          setTargetDefinitions([]);
        }

        const hp = data.homepage ?? { title: '', texts: [], photo: '' };
        if (hp && hp.title) {
          setHomepage(hp);
          setLSItem(HOMEPAGE_LS_KEY, hp);
        }
      }
    } catch (err) {
      console.error('Erreur fetchSchoolSettings:', err);
    } finally {
      setFeeDefinitionsLoaded(true);
      setTargetDefinitionsLoaded(true);
      setHomepageLoaded(true);
    }
  }, []);

  // Save fee definitions to BD and LS
  const saveFeeDefinitions = useCallback(async (defs) => {
    try {
      const res = await fetch('/api/school_ai/ecole', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeDefinitions: defs }),
      });
      if (!res.ok) throw new Error('PUT /api/school_ai/ecole failed');
      const data = await res.json();
      const saved = data.feeDefinitions ?? defs;
      setFeeDefinitions(saved);
      setLSItem(FEE_DEFINITIONS_LS_KEY, saved);
      return saved;
    } catch (err) {
      console.error('Erreur saveFeeDefinitions:', err);
      throw err;
    }
  }, []);

  // Save target definitions to BD and LS
  const saveTargetDefinitions = useCallback(async (targets, removedTargetKey = null) => {
    try {
      const payload = { targets };
      if (removedTargetKey) payload.removedTargetKey = removedTargetKey;
      const res = await fetch('/api/school_ai/ecole', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('PUT /api/school_ai/ecole (targets) failed');
      const data = await res.json();
      const saved = data.targets ?? targets;
      setTargetDefinitions(saved);
      setLSItem(TARGET_DEFINITIONS_LS_KEY, saved);
      return saved;
    } catch (err) {
      console.error('Erreur saveTargetDefinitions:', err);
      throw err;
    }
  }, []);

  // Save homepage configuration to BD and LS
  const saveHomepage = useCallback(async (hp) => {
    try {
      const res = await fetch('/api/school_ai/ecole', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homepage: hp }),
      });
      if (!res.ok) throw new Error('PUT /api/school_ai/ecole (homepage) failed');
      const data = await res.json();
      const saved = data.homepage ?? hp;
      setHomepage(saved);
      setLSItem(HOMEPAGE_LS_KEY, saved);
      return saved;
    } catch (err) {
      console.error('Erreur saveHomepage:', err);
      throw err;
    }
  }, []);

  /**
   * Resolve target amount for a specific fee definition based on student profile.
   * Implements universal fallback for 'is*' (boolean) profiles.
   */
  const resolveTargetAmount = useCallback((feeDef, targetsList, targetDefs = targetDefinitions) => {
    if (!feeDef || !Array.isArray(feeDef.targets)) return 0;

    const activeTargets = Object.values(targetsList || {}).flat();
    const match = feeDef.targets.find(t => activeTargets.includes(t.label));
    if (match) return match.amount;

    // Universal fallback: Check missing boolean 'is*' targets
    // We look for any 'is*' target definition whose secondary (fallback) option is present in the fee's targets
    const missingBooleans = (targetDefs || []).filter(td => td.key.startsWith('is') && !targetsList?.[td.key]);
    const fallbackOptions = missingBooleans.map(td => td.options[1]);

    const fallbackMatch = feeDef.targets.find(t => fallbackOptions.includes(t.label));
    return fallbackMatch ? fallbackMatch.amount : 0;
  }, [targetDefinitions]);



  // --- CRUD élèves / enseignants / classes (logique partagée, cf. useResourceCrud) ---
  const { fetchList: fetchEleves, save: saveEleve, remove: deleteEleve } =
    useResourceCrud('eleves', setEleves, setElevesLoaded, setSelected);
  const { fetchList: fetchEnseignants, save: saveEnseignant, remove: deleteEnseignant } =
    useResourceCrud('enseignants', setEnseignants, setEnseignantsLoaded, setSelected);
  const { fetchList: fetchClasses, save: saveClasse, remove: deleteClasse } =
    useResourceCrud('classes', setClasses, setClassesLoaded, setSelected);

  // --- NOTES & ABSENCES (Story 1.4) ---
  // PATCH partiel d'un élève (notes/absences) : on ne synchronise état + LS
  // qu'après confirmation back-end (aucune écriture optimiste, rien à annuler).
  const patchEleve = useCallback(async (eleveId, patch, errLabel) => {
    try {
      const res = await fetch(`/api/school_ai/eleves/${eleveId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Request failed');
      }
      const updated = await res.json();
      setEleves(prev => {
        const newList = prev.map(e => e._id === eleveId ? updated : e);
        setLSItem('eleves', newList);
        return newList;
      });
      return updated;
    } catch (err) {
      console.error(errLabel, err);
      throw err;
    }
  }, []);

  const saveEleveNotes = useCallback(
    (eleveId, compositions) => patchEleve(eleveId, { compositions }, 'Erreur lors de la sauvegarde des notes:'),
    [patchEleve]
  );
  const saveEleveAbsences = useCallback(
    (eleveId, absences) => patchEleve(eleveId, { absences }, 'Erreur lors de la sauvegarde des absences:'),
    [patchEleve]
  );

  // --- SUBJECTS ---
  const fetchSubjects = useCallback(async (bypassCache = false) => {
    try {
      const cachedData = !bypassCache ? getLSItem('app_subjects') : null;
      if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
        setDynamicSubjects(cachedData);
        setSubjectsLoaded(true);
        return;
      }

      const response = await fetch('/api/subjects');
      if (!response.ok) throw new Error(`GET /api/subjects -> ${response.status}`);
      const data = await response.json();
      if (data.success && data.data) {
        const sortedData = data.data
          .filter(subject => subject.isActive)
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        const subjects = sortedData.map(subject => ({
          id: subject._id || subject.id,
          nom: subject.nom
        }));

        setLSItem('app_subjects', subjects);
        setDynamicSubjects(subjects);
        setSubjectsLoaded(true);
      }
    } catch (error) {
      console.error('Erreur chargement matières context:', error);
      setSubjectsLoaded(true);
    }
  }, []);

  // --- UPLOAD ---
  const uploadFile = useCallback(async (payload) => {
    const { file, type, documents, ...payload_ } = payload;
    let json = JSON.stringify(payload_);
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (documents && Array.isArray(documents)) {
      documents.forEach(doc => {
        formData.append('file', doc.file);
      });
      // Ajoute la meta des noms personnalisés dans l'ordre
      formData.append('documentsMeta', JSON.stringify(documents.map(doc => doc.customName)));
    }
    formData.append('type', type);
    formData.append('payload', json);
    payload.entityType && formData.append('entityType', payload.entityType);
    const res = await fetch('/api/school_ai/media', {
      method: 'POST',
      body: formData
    });
    return await res.json(); // { paths }
  }, []);

  // Ne déclenche le reset/re-sync que sur un VRAI changement d'identité,
  // pas au montage initial (le chargement initial est géré par l'auto-fetch
  // cache-first plus bas). Évite de vider le cache à chaque rechargement de page.
  // --- GROUPED BOOTSTRAP FETCH (1 seul appel HTTP au lieu de 5) ---
  const fetchBootstrap = useCallback(async (bypassCache = false) => {
    try {
      const res = await fetch('/api/school_ai/bootstrap');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.classes)) { setClasses(data.classes); setLSItem('classes', data.classes); }
        if (Array.isArray(data.eleves)) { setEleves(data.eleves); setLSItem('eleves', data.eleves); }
        if (Array.isArray(data.enseignants)) { setEnseignants(data.enseignants); setLSItem('enseignants', data.enseignants); }
        if (Array.isArray(data.subjects)) { setDynamicSubjects(data.subjects); setLSItem('app_subjects', data.subjects); }
        if (data.ecole) {
          setFeeDefinitions(data.ecole.feeDefinitions || []);
          setTargetDefinitions(data.ecole.targets || []);
          setHomepage(data.ecole.homepage || {});
          setLSItem(FEE_DEFINITIONS_LS_KEY, data.ecole.feeDefinitions || []);
          setLSItem(TARGET_DEFINITIONS_LS_KEY, data.ecole.targets || []);
          setLSItem(HOMEPAGE_LS_KEY, data.ecole.homepage || {});
        }
      }
    } catch (err) {
      console.error('Erreur fetchBootstrap:', err);
    } finally {
      setClassesLoaded(true);
      setElevesLoaded(true);
      setEnseignantsLoaded(true);
      setSubjectsLoaded(true);
      setFeeDefinitionsLoaded(true);
      setTargetDefinitionsLoaded(true);
      setHomepageLoaded(true);
    }
  }, []);

  const isFirstAuthRun = useRef(true);
  useEffect(() => {
    if (isFirstAuthRun.current) {
      isFirstAuthRun.current = false;
      return;
    }

    clearLS();
    setEleves([]);
    setEnseignants([]);
    setClasses([]);
    setDynamicSubjects([]);
    setFeeDefinitions([]);
    setTargetDefinitions([]);
    setHomepage({ title: '', texts: [], photo: '' });

    const timer = setTimeout(() => {
      fetchBootstrap(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [userId, fetchBootstrap]);

  // --- AUTO FETCH AU MONTAGE UNIFIÉ ---
  useEffect(() => {
    const hasCachedClasses = !!getLSItem('classes')?.length;
    const hasCachedEleves = !!getLSItem('eleves')?.length;
    const hasCachedEnseignants = !!getLSItem('enseignants')?.length;

    if (!hasCachedClasses || !hasCachedEleves || !hasCachedEnseignants) {
      fetchBootstrap();
    } else {
      if (!classesLoaded) fetchClasses();
      if (!elevesLoaded) fetchEleves();
      if (!enseignantsLoaded) fetchEnseignants();
      if (!subjectsLoaded) fetchSubjects();
      if (!feeDefinitionsLoaded || !targetDefinitionsLoaded || !homepageLoaded) fetchSchoolSettings();
    }
  }, [classesLoaded, fetchClasses, elevesLoaded, fetchEleves, enseignantsLoaded, fetchEnseignants, subjectsLoaded, fetchSubjects, feeDefinitionsLoaded, targetDefinitionsLoaded, homepageLoaded, fetchSchoolSettings, fetchBootstrap]);







  const contextValue = useMemo(() => ({
    eleves, fetchEleves, saveEleve, deleteEleve,
    saveEleveNotes, saveEleveAbsences,
    enseignants, fetchEnseignants, saveEnseignant, deleteEnseignant,
    classes, fetchClasses, saveClasse, deleteClasse,
    dynamicSubjects, fetchSubjects, subjectsLoaded,
    feeDefinitions, feeDefinitionsLoaded, saveFeeDefinitions, normalizeFeeItem,
    targetDefinitions, targetDefinitionsLoaded, saveTargetDefinitions,
    homepage, homepageLoaded, saveHomepage,
    resolveTargetAmount,
    uploadFile,
    fetchBootstrap,
    selected, setSelected, showModal, setShowModal, editType, setEditType
  }), [
    eleves, fetchEleves, saveEleve, deleteEleve,
    saveEleveNotes, saveEleveAbsences,
    enseignants, fetchEnseignants, saveEnseignant, deleteEnseignant,
    classes, fetchClasses, saveClasse, deleteClasse,
    dynamicSubjects, fetchSubjects, subjectsLoaded,
    feeDefinitions, feeDefinitionsLoaded, saveFeeDefinitions, normalizeFeeItem,
    targetDefinitions, targetDefinitionsLoaded, saveTargetDefinitions,
    homepage, homepageLoaded, saveHomepage,
    resolveTargetAmount,
    uploadFile,
    fetchBootstrap,
    selected, showModal, editType
  ]);

  return (
    <AiAdminContext.Provider value={contextValue}>
      {children}
    </AiAdminContext.Provider>
  );
};
