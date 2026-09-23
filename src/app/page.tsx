import Link from 'next/link'
const modules = [
  ["Students", "Profiles, enrollment, classes, attendance and student records."],
  ["Teachers & Staff", "Roles, assignments, schedules and school responsibilities."],
  ["Parents", "A clear parent portal for grades, attendance, meetings and updates."],
  ["Academics", "Subjects, grades, assignments, quizzes and academic documents."],
  ["Attendance", "Check-in, check-out, lateness and attendance history."],
  ["Administration", "School operations, reports, documents and analytics in one place."],
];

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <div className="container nav">
          <Link href="/" className="brand">AtechOS</Link>

          <nav className="nav-links">
            <a href="#modules">Modules</a>
            <a href="#about">About</a>
            <a href="/signin">Sign in</a>
            <a href="/signup" className="nav-signup">
              Sign up
            </a>
          </nav>
        </div>
      </header>

      <section className="hero container">
        <div className="hero-content">
          <div className="eyebrow">SCHOOL MANAGEMENT PLATFORM</div>

          <h1>
            The Operating System
            <br />
            <span>for Schools.</span>
          </h1>

          <p className="hero-text">
            AtechOS brings school administration, academics, attendance,
            teachers, students and parents together in one secure platform.
          </p>

          <div className="actions">
            <a href="/signup" className="button primary">
              Create your school
            </a>

            <a href="/signin" className="button">
              Sign in
            </a>
          </div>

          <div className="trust">
            <span>✓ Students</span>
            <span>✓ Teachers</span>
            <span>✓ Parents</span>
            <span>✓ Administration</span>
          </div>
        </div>
      </section>

      <section id="modules" className="container modules-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">ONE PLATFORM</div>
            <h2>Everything your school needs.</h2>
          </div>

          <p>
            Explore the platform. Sign in to open the modules available to your school account.
          </p>
        </div>

        <div className="modules-grid">
          {modules.map(([title, description]) => (
            <article className="module-card" key={title}>
              <div className="module-icon">
                {title === "Students" && "ST"}
                {title === "Teachers & Staff" && "TS"}
                {title === "Parents" && "PA"}
                {title === "Academics" && "AC"}
                {title === "Attendance" && "AT"}
                {title === "Administration" && "AD"}
              </div>

              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="container about-section">
        <div className="about-card">
          <div>
            <div className="eyebrow">ATECHOS</div>
            <h2>Built for the complete school community.</h2>
            <p>
              From the principal and administrative team to teachers,
              students and parents, AtechOS creates one connected digital
              environment for your school.
            </p>
          </div>

          <a href="/signup" className="button primary">
            Start with AtechOS
          </a>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <strong>AtechOS</strong>
            <span> The Operating System for Schools.</span>
          </div>

          <div className="footer-links">
            <a href="/signin">Sign in</a>
            <a href="/signup">Create account</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
