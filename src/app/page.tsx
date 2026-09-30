import { Film } from "@/film/Film";
import { FilmStrip } from "@/film/FilmStrip";
import { PROJECTS } from "@/content/projects";
import { COMPANY, PRACTICES, PRACTICES_INTRO, CERTIFICATION_NOTE, ENGAGEMENT_MODELS, ENGAGEMENT_NOTES, TESTIMONIALS } from "@/content/company";
import s from "./page.module.css";

const GATES = new Set(["Human Review Checkpoints", "Fallback Flows"]);
const MAKING = [
  { n: "01", t: "Four stills", d: "Each key moment was generated as a photograph with Gemini: the arm above the socket, the chip seated, the lit traces, the lab at rest. None of them contain text or interface." },
  { n: "02", t: "One clip between two frames", d: "Veo 3.1 was given the first and the last still and asked for the eight seconds between them: one continuous shot, no cuts." },
  { n: "03", t: "Scroll becomes the playhead", d: "The clip is cut into 96 frames that the page draws as you scroll, forwards and backwards. Phones and reduced-motion settings get the stills instead." },
];

export default function Home() {
  const quote = TESTIMONIALS[0];
  return (
    <>
      <div data-loader className={s.loader} aria-hidden="true">
        <p className={s.loaderName}>Tech Cogniverse</p>
        <span className={s.loaderTrack}><span data-bar className={s.loaderBar} /></span>
      </div>

      <header className={s.header}>
        <a href="#main" className={s.brand}>Tech Cogniverse</a>
        <nav aria-label="Main" className={s.nav}>
          <a href="#work">Work</a>
          <a href="#making">The film</a>
          <a href="#trust">Practices</a>
          <a className={s.navCta} href="#contact">Start a project</a>
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        <Film />

        <section id="work" className={s.section} aria-labelledby="work-title">
          <div className={s.head}>
            <p className="label">Work</p>
            <h2 id="work-title" className={s.h2}>{PROJECTS.length} builds, each with its real status.</h2>
          </div>
          <ol className={s.work}>
            {PROJECTS.map((p) => (
              <li key={p.slug}>
                <p className={s.workName}>{p.name}</p>
                <p className={s.workSummary}>{p.summary}</p>
                <p className={`label ${s.workMeta}`}>{p.category} · <span data-status={p.status}>{p.status}</span></p>
              </li>
            ))}
          </ol>
        </section>

        <section id="making" className={`${s.section} ${s.making}`} aria-labelledby="making-title">
          <div className={s.head}>
            <p className="label">How this film was made</p>
            <h2 id="making-title" className={s.h2}>Two stills in. Eight seconds out.</h2>
            <p className={s.lede}>The film above is generated, not shot. This is the pipeline, in the order it ran.</p>
          </div>
          <div className={s.makingGrid}>
            <FilmStrip />
            <ol className={s.makingSteps}>
              {MAKING.map((m) => (
                <li key={m.n}><p className="label">{m.n}</p><h3 className={s.h3}>{m.t}</h3><p>{m.d}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section id="trust" className={s.section} aria-labelledby="trust-title">
          <div className={s.head}>
            <p className="label">Practices</p>
            <h2 id="trust-title" className={s.h2}>The same checklist on every build.</h2>
            <p className={s.lede}>{PRACTICES_INTRO}</p>
          </div>
          <ol className={s.practices}>
            {PRACTICES.map((p) => (
              <li key={p.title} data-gate={GATES.has(p.title) || undefined}><h3 className={s.h4}>{p.title}</h3><p>{p.description}</p></li>
            ))}
          </ol>
          <p className={s.note}>{CERTIFICATION_NOTE}</p>
          <figure className={s.quote}>
            <blockquote>“{quote.quote}”</blockquote>
            <figcaption className="label">{quote.name} · {quote.role}</figcaption>
          </figure>
        </section>

        <section id="contact" className={`${s.section} ${s.contact}`} aria-labelledby="contact-title">
          <div className={s.head}>
            <p className="label">Start a project</p>
            <h2 id="contact-title" className={s.h2}>Tell us what slows your business down.</h2>
            <p className={s.lede}>{COMPANY.responseTime}. The next step is a 20-minute scoping call, then a 2-page proposal with a fixed price.</p>
          </div>
          <div className={s.contactRow}>
            <a className="btn" href={`mailto:${COMPANY.email}?subject=${encodeURIComponent("A project for Tech Cogniverse")}`}>Email {COMPANY.email}</a>
            <a className="btn btn--ghost" href={`tel:${COMPANY.phone.tel}`}>Call {COMPANY.phone.display}</a>
          </div>
          <ul className={s.models}>
            {ENGAGEMENT_MODELS.map((m) => (
              <li key={m.name}><h3 className={s.h4}>{m.name}</h3><p className="label">{m.duration} · {m.priceINR} · {m.priceUSD}</p><p>{m.included.join(" · ")}</p></li>
            ))}
          </ul>
          <p className={s.small}>{ENGAGEMENT_NOTES.join(" ")}</p>
        </section>
      </main>

      <footer className={s.footer}>
        <p className={s.footerName}>Tech Cogniverse</p>
        <address>{COMPANY.address}</address>
        <p className="label">© {new Date().getFullYear()} {COMPANY.name}</p>
      </footer>
    </>
  );
}
