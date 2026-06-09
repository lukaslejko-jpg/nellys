"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { deterministicScramble } from "@/lib/domain/pyraminx/fixtures";
import {
  assignCaptureMedia,
  createEmptyInspectionDraft,
  createInspectionGuide,
  pyraminxFaceIds,
  setCaptureStickerColor,
  stickerColorIds,
  validateInspectionDraft,
  type InspectionDraft,
  type PyraminxFaceId,
  type StickerColorId
} from "@/lib/domain/pyraminx/media-inspection";
import { inverseSequence, legalMoves, parseMoveSequence, type PyraminxMove } from "@/lib/domain/pyraminx/moves";
import { applyMove, applySequence } from "@/lib/domain/pyraminx/simulator";
import type { PyraminxState } from "@/lib/domain/pyraminx/state";
import { createSolvedState, isSolved, serializeState } from "@/lib/domain/pyraminx/state";

type ApiResult =
  | { ok: true; session: { id: string; status: string; solutionMoves?: string[] | null } }
  | { ok: false; code: string; messageSk?: string };

export function ManualSolverPanel() {
  const [state, setState] = useState<PyraminxState>(() => createSolvedState());
  const [inputMoves, setInputMoves] = useState<PyraminxMove[]>([]);
  const [scrambleText, setScrambleText] = useState("");
  const [status, setStatus] = useState("");
  const [moves, setMoves] = useState<string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const demoScramble = deterministicScramble(20260609, 4);

  function applyUiMove(move: PyraminxMove) {
    setState((current) => applyMove(current, move));
    setInputMoves((current) => [...current, move]);
    setMoves(null);
    setStatus("");
  }

  function applyDemoScramble() {
    setState(applySequence(createSolvedState(), demoScramble));
    setInputMoves(demoScramble);
    setScrambleText(demoScramble.join(" "));
    setMoves(null);
    setStatus("Demo scramble bol vytvoreny deterministickym simulatorom.");
  }

  function resetState() {
    setState(createSolvedState());
    setInputMoves([]);
    setScrambleText("");
    setMoves(null);
    setStatus("Stav bol resetovany na vyrieseny Pyraminx.");
  }

  function applyScrambleText() {
    const parsed = parseMoveSequence(scrambleText);
    if (!parsed.ok) {
      setStatus(`Neplatne tahy: ${parsed.invalidTokens.join(", ")}`);
      setMoves(null);
      return;
    }

    setState(applySequence(createSolvedState(), parsed.moves));
    setInputMoves(parsed.moves);
    setMoves(inverseSequence(parsed.moves));
    setStatus("Scramble bol odsimulovany. Inverzne riesenie je vypocitane deterministicky.");
  }

  async function runSolverFlow() {
    setIsSubmitting(true);
    setStatus("");
    setMoves(null);

    try {
      const created = await postJson<ApiResult>("/api/puzzle-sessions");
      if (!created.ok) return setStatus(created.messageSk ?? "Session sa nepodarilo vytvorit.");

      const saved = await putJson<ApiResult>(`/api/puzzle-sessions/${created.session.id}/state`, {
        correctedState: state
      });
      if (!saved.ok) return setStatus(saved.messageSk ?? "Stav sa nepodarilo ulozit.");

      const solved = await postJson<ApiResult>(`/api/puzzle-sessions/${created.session.id}/solve`);
      if (!solved.ok) return setStatus(solved.messageSk ?? "Solver tok sa nepodarilo dokoncit.");

      setMoves(solved.session.solutionMoves ?? []);
      setStatus("Riesenie vypocital a overil deterministicky solver.");
    } catch {
      setStatus("Poziadavka zlyhala. Skontroluj prihlasenie a databazu.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="manual-solver">
      <div>
        <h2>Nove riesenie</h2>
        <p className="muted">
          Manualne vytvor stav cez legalne Pyraminx tahy a spusti solver cez API.
        </p>
      </div>
      <div className="move-pad" aria-label="Legalne Pyraminx tahy">
        {legalMoves.map((move) => (
          <button className="move-button" key={move} onClick={() => applyUiMove(move)} type="button">
            {move}
          </button>
        ))}
      </div>
      <label className="field compact-field">
        <span>Scramble zapis</span>
        <textarea
          onChange={(event) => setScrambleText(event.target.value)}
          placeholder="napr. U R' L B"
          rows={2}
          value={scrambleText}
        />
      </label>
      <div className="solver-actions three-actions">
        <button className="button secondary" onClick={applyScrambleText} type="button">
          Pouzit scramble
        </button>
        <button className="button secondary" onClick={applyDemoScramble} type="button">
          Demo scramble
        </button>
        <button className="button secondary" onClick={resetState} type="button">
          Reset
        </button>
      </div>
      <div className="state-summary">
        <span>Stav</span>
        <strong>{isSolved(state) ? "Vyrieseny" : "Zmeneny"}</strong>
      </div>
      <p className="muted">
        Zadane tahy: {inputMoves.length > 0 ? inputMoves.join(" ") : "ziadne"}
      </p>
      <button className="button" disabled={isSubmitting} onClick={runSolverFlow} type="button">
        {isSubmitting ? "Pocitam..." : "Vypocitat riesenie"}
      </button>
      {status ? <p className="form-status">{status}</p> : null}
      {moves ? (
        <div className="solution-box">
          <span>Riesenie</span>
          <strong>{moves.length > 0 ? moves.join(" ") : "ziadne tahy"}</strong>
        </div>
      ) : null}
      <details>
        <summary>Manualny vstup pre tento krok</summary>
        <pre>{serializeState(state)}</pre>
      </details>
    </div>
  );
}

export function PhotoUploadPanel() {
  const [media, setMedia] = useState<{ name: string; url: string; type: "image" | "video" }[]>([]);
  const [activeMediaName, setActiveMediaName] = useState("");
  const [activeFace, setActiveFace] = useState<PyraminxFaceId>("U");
  const [captureMode, setCaptureMode] = useState<"photos" | "video">("photos");
  const [coachStep, setCoachStep] = useState(0);
  const [draft, setDraft] = useState<InspectionDraft>(() => createEmptyInspectionDraft());
  const [status, setStatus] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const validation = validateInspectionDraft(draft);
  const guide = createInspectionGuide(draft, { mode: captureMode, hasMedia: media.length > 0 });
  const coachSteps = buildCoachSteps(captureMode, media.length);
  const currentCoachStep = coachSteps[Math.min(coachStep, coachSteps.length - 1)];

  useEffect(() => {
    return () => {
      media.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [media]);

  function handleMedia(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 6);
    const nextMedia = files.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type.startsWith("video/") || file.name.toLowerCase().endsWith(".qt") ? "video" as const : "image" as const
    }));

    media.forEach((item) => URL.revokeObjectURL(item.url));
    setMedia(nextMedia);
    setActiveMediaName(nextMedia[0]?.name ?? "");
    setCoachStep(0);
    setDraft(
      nextMedia[0]
        ? assignCaptureMedia(createEmptyInspectionDraft(), "U", nextMedia[0].name)
        : createEmptyInspectionDraft()
    );
    setStatus(
      files.length > 0
        ? captureMode === "video"
          ? "Video je nahrate. Pozri si AI pokyny a ukaz ihlan pomaly zo vsetkych stran."
          : "Fotky su nahrate. Pozri si AI pokyny a skontroluj, ci vidno cele strany ihlanu."
        : ""
    );
  }

  function assignMediaToFace(face: PyraminxFaceId) {
    if (!activeMediaName) {
      setStatus("Najprv vyber fotku alebo video, ktore patri k tejto strane.");
      return;
    }

    setActiveFace(face);
    setDraft((current) => assignCaptureMedia(current, face, activeMediaName));
    setStatus(`Strana ${face} je priradena k suboru ${activeMediaName}. Teraz oznac tri farby.`);
  }

  function setStickerColor(face: PyraminxFaceId, index: 0 | 1 | 2, color: StickerColorId) {
    setDraft((current) => setCaptureStickerColor(current, face, index, color, activeMediaName));
  }

  function confirmInspection() {
    const result = validateInspectionDraft(draft);
    if (result.ok) {
      setStatus(result.messageSk);
      return;
    }

    setStatus(
      result.missingFaces.length > 0
        ? `Dopln priradenie fotky pre strany: ${result.missingFaces.join(", ")}.`
        : `Dopln este ${result.missingStickers} kontrolnych farieb.`
    );
  }

  function speakGuide() {
    if (!soundEnabled) {
      setStatus("Zvuk je vypnuty. Najprv zapni zvuk AI sprievodcu.");
      return;
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setStatus("Hlasove citanie nie je v tomto prehliadaci dostupne.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(guide.spokenText);
    utterance.lang = "sk-SK";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    setStatus("Citam dalsi krok nahlas.");
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setStatus(next ? "Zvuk AI sprievodcu je zapnuty." : "Zvuk AI sprievodcu je vypnuty.");
  }

  function stopSpeech() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setStatus("Hlasove citanie je zastavene.");
  }

  function nextCoachStep() {
    setCoachStep((current) => Math.min(current + 1, coachSteps.length - 1));
    setStatus("Dalsi pokyn je pripraveny.");
  }

  function resetCoachStep() {
    setCoachStep(0);
    setStatus(
      captureMode === "video"
        ? "Zacni znova: chyt ihlan spickou hore a ukaz prvu celu stranu."
        : "Zacni znova: skontroluj prvu fotku a potom dopln dalsie strany."
    );
  }

  function markMediaProblem() {
    setStatus(
      captureMode === "video"
        ? "Natoc video znova pomalsie. Na kazdej strane zastav a pocitaj jeden, dva."
        : "Nahraj ostrejsiu fotku. Strana musi byt cela v zabere a bez odlesku."
    );
  }

  return (
    <div className="manual-solver">
      <div>
        <h2>1. Nahraj Pyraminx</h2>
        <p className="muted">
          Nellys teraz riesi ihlan Pyraminx. Klasicka Rubikova kocka bude samostatny model,
          preto zatial fot alebo toc iba Pyraminx.
        </p>
      </div>
      <div className="capture-mode" aria-label="Rezim nahratia">
        <button
          className={captureMode === "photos" ? "face-tab active" : "face-tab"}
          onClick={() => setCaptureMode("photos")}
          type="button"
        >
          Fotky
        </button>
        <button
          className={captureMode === "video" ? "face-tab active" : "face-tab"}
          onClick={() => setCaptureMode("video")}
          type="button"
        >
          Video
        </button>
      </div>
      <div className="capture-guide">
        <strong>{captureMode === "photos" ? "Ako nafotit ihlan" : "Ako natocit video"}</strong>
        {captureMode === "photos" ? (
          <ol>
            <li>Poloz Pyraminx na dobre svetlo bez odleskov.</li>
            <li>Odfot postupne styri strany: U, L, R, B.</li>
            <li>Kazda fotka ma ukazat jednu celu farebnu stranu a hrany okolo nej.</li>
            <li>Ak si nie si isty stranou, nahraj viac fotiek. Potom ich priradis nizsie.</li>
          </ol>
        ) : (
          <ol>
            <li>Natoc pomale video okolo celeho Pyraminxu.</li>
            <li>Na kazdej strane sa zastav aspon na dve sekundy.</li>
            <li>Drz hlavolam v strede zaberu, bez rychleho trasenia.</li>
            <li>Po nahrati vyber ostre snimky a potvrdis farby rucne.</li>
          </ol>
        )}
      </div>
      <label className="upload-box">
        <span>{captureMode === "photos" ? "Vybrat fotky Pyraminxu" : "Vybrat video Pyraminxu"}</span>
        <input accept="image/*,video/*,.qt,.mov,.mp4" multiple onChange={handleMedia} type="file" />
      </label>
      {media.length > 0 ? (
        <div className="inspection-workflow">
          <div className="photo-grid">
            {media.map((item) => (
              <figure className={activeMediaName === item.name ? "active-media" : ""} key={item.url}>
                <button
                  aria-label={`Vybrat subor ${item.name}`}
                  className="media-select"
                  onClick={() => setActiveMediaName(item.name)}
                  type="button"
                >
                  {item.type === "video" ? (
                    <video controls muted playsInline src={item.url} />
                  ) : (
                    <img alt={item.name} src={item.url} />
                  )}
                </button>
                <figcaption>{item.name}</figcaption>
              </figure>
            ))}
          </div>

          <div className="ai-guide primary-guide">
            <div>
              <span>AI</span>
              <h3>{guide.title}</h3>
              <p>{guide.summary}</p>
            </div>
            <div className="live-coach" aria-live="polite">
              <small>Krok {Math.min(coachStep + 1, coachSteps.length)} z {coachSteps.length}</small>
              <strong>{currentCoachStep.title}</strong>
              <p>{currentCoachStep.body}</p>
            </div>
            <div className="coach-actions">
              <button className="button" onClick={nextCoachStep} type="button">
                Hotovo, dalsi krok
              </button>
              <button className="button secondary" onClick={markMediaProblem} type="button">
                Nevidim dobre
              </button>
              <button className="button secondary" onClick={resetCoachStep} type="button">
                Zacat znova
              </button>
            </div>
            <details className="all-guide-steps">
              <summary>Zobrazit vsetky kroky</summary>
              <ol className="guide-steps">
                {guide.nextActions.map((action, index) => (
                  <li key={action}>
                    <span>{index + 1}</span>
                    <p>{action}</p>
                  </li>
                ))}
              </ol>
            </details>
            <div className="ai-boundaries">
              {guide.aiBoundaries.map((boundary) => (
                <p key={boundary}>{boundary}</p>
              ))}
            </div>
            <div className="sound-controls">
              <button className="button secondary" onClick={toggleSound} type="button">
                {soundEnabled ? "Vypnut zvuk" : "Zapnut zvuk"}
              </button>
              <button className="button secondary" disabled={!soundEnabled} onClick={speakGuide} type="button">
                Precitat dalsi krok
              </button>
              <button className="button secondary" onClick={stopSpeech} type="button">
                Zastavit zvuk
              </button>
            </div>
          </div>

          <details className="advanced-inspection">
            <summary>Pokrocile: rucne overit farby</summary>
          <div className="inspection-panel">
            <div className="state-summary">
              <span>Aktivny subor</span>
              <strong>{activeMediaName || "ziadny"}</strong>
            </div>
            <div className="face-tabs" aria-label="Strany Pyraminxu">
              {pyraminxFaceIds.map((face) => (
                <button
                  className={activeFace === face ? "face-tab active" : "face-tab"}
                  key={face}
                  onClick={() => assignMediaToFace(face)}
                  type="button"
                >
                  {face}
                </button>
              ))}
            </div>
            <div className="sticker-board">
              {draft.captures
                .filter((capture) => capture.face === activeFace)
                .map((capture) => (
                  <div key={capture.face}>
                    <p className="muted">
                      Strana {capture.face}: {capture.mediaName || "bez priradenej fotky"}
                    </p>
                    <div className="sticker-grid">
                      {capture.colors.map((selected, index) => (
                        <div className="sticker-cell" key={`${capture.face}-${index}`}>
                          <span>bod {index + 1}</span>
                          <div className="swatch-row">
                            {stickerColorIds.map((color) => (
                              <button
                                aria-label={`Nastavit ${color} pre ${capture.face} bod ${index + 1}`}
                                className={selected === color ? `swatch ${color} active` : `swatch ${color}`}
                                key={color}
                                onClick={() => setStickerColor(capture.face, index as 0 | 1 | 2, color)}
                                type="button"
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
            <button className="button" onClick={confirmInspection} type="button">
              Overit foto inspekciu
            </button>
            <div className={validation.ok ? "solution-box" : "inspection-warning"}>
              <span>{validation.ok ? "Pripravene" : "Chyba podklad"}</span>
              <p>{validation.messageSk}</p>
              {!validation.ok ? (
                <p>
                  Chybaju strany: {validation.missingFaces.length ? validation.missingFaces.join(", ") : "ziadne"}.
                  Neoznacene body: {validation.missingStickers}.
                </p>
              ) : null}
            </div>
          </div>
          </details>
        </div>
      ) : null}
      {status ? <p className="form-status">{status}</p> : null}
      <div className="suggestion-list">
        <strong>Ak video nepomoze</strong>
        <p>Natoc ho este raz pomalsie.</p>
        <p>Na kazdej strane zastav aspon na dve sekundy.</p>
        <p>Ihlan drz v strede obrazu a bez prudkeho pohybu.</p>
      </div>
    </div>
  );
}

function buildCoachSteps(mode: "photos" | "video", mediaCount: number): { title: string; body: string }[] {
  if (mode === "video") {
    return [
      {
        title: "Chyt ihlan spickou hore.",
        body: "Daj jednu celu farebnu stranu rovno pred kameru. Nehyb sa a pocitaj jeden, dva."
      },
      {
        title: "Otoc ihlan doprava.",
        body: "Ukaz druhu stranu. Zastav na dve sekundy, aby bola strana ostra."
      },
      {
        title: "Otoc ihlan este raz doprava.",
        body: "Ukaz tretiu stranu. Drz ju v strede obrazu."
      },
      {
        title: "Otoc ihlan na poslednu stranu.",
        body: "Ukaz stvrtu stranu. Zase chvilu stoj."
      },
      {
        title: "Naklon ihlan trochu hore a dole.",
        body: "Tak bude vidno aj hrany medzi farbami. Ak sa obraz trasie, natoc video znova pomalsie."
      },
      {
        title: "Video je pripravene na kontrolu.",
        body: "Ak boli vsetky styri strany ostre, pokracuj. Ak nie, stlac Nevidim dobre a nahraj nove video."
      }
    ];
  }

  const missing = Math.max(0, 4 - mediaCount);
  return [
    {
      title: mediaCount >= 4 ? "Mas dost fotiek." : `Chybaju este ${missing} fotky.`,
      body:
        mediaCount >= 4
          ? "Teraz skontroluj, ci kazda fotka ukazuje jednu celu stranu ihlanu."
          : "Potrebujeme styri ostre fotky. Kazda fotka ma ukazat inu celu stranu ihlanu."
    },
    {
      title: "Skontroluj prvu fotku.",
      body: "Je strana cela v zabere? Ak nie, odfot ju znova."
    },
    {
      title: "Otoc ihlan doprava a odfot dalsiu stranu.",
      body: "Nepotrebujes poznat nazvy stran. Len ukaz dalsiu farebnu stranu."
    },
    {
      title: "Zopakuj to, kym mas styri strany.",
      body: "Kazda strana ma byt ostra, bez odlesku a v strede fotky."
    },
    {
      title: "Fotky su pripravene na kontrolu.",
      body: "Ak niektora fotka chyba alebo je rozmazana, nahraj ju znova."
    }
  ];
}

async function postJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: "POST" });
  return response.json() as Promise<T>;
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return response.json() as Promise<T>;
}
