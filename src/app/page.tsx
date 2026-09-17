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
        <div className="container brand">AtechOS</div>
      </header>
      <section className="hero container">
        <div>
          <h1>The Operating System for Schools.</h1>
          <p>
            AtechOS brings school administration, academics, attendance, teachers,
            students and parents together in one secure platform.
          </p>
          <div className="actions">
            <a className="button primary" href="#modules">Explore AtechOS</a>
            <a className="button" href="#modules">View modules</a>
          </div>
        </div>
      </section>
      <section id="modules" className="container grid">
        {modules.map(([title, description]) => (
          <article className="card" key={title}>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
