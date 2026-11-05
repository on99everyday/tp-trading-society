import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AREAS, QUIZZES } from "../course";
import { Pending, Shell, useAuthedProfile } from "../components/Shell";

export function HomePage() {
  const { profile, pending } = useAuthedProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!pending && !profile) navigate("/login");
  }, [pending, profile, navigate]);

  if (pending || !profile) return <Pending />;
  return <Home profile={profile} />;
}

function Home({ profile }) {
  const [selected, setSelected] = useState(null);

  return (
    <Shell profile={profile}>
      <section className="mb-6">
        <p className="text-sm text-gold">課程首頁</p>
        <h1 className="mt-1 text-3xl font-semibold">
          {profile ? `${profile.displayName}，繼續學習` : "課程中心"}
        </h1>
      </section>
      <div className="grid gap-3 md:grid-cols-3">
        {AREAS.map((area, index) => {
          const active = selected === area.id;
          const className = `rounded-xl border px-4 py-4 text-left ${
            active ? "border-gold bg-gold text-bg" : "border-line bg-surface"
          }`;
          const body = (
            <>
              <p className={`text-xs font-medium ${active ? "text-bg/70" : "text-gold"}`}>0{index + 1}</p>
              <p className="mt-1 text-lg font-semibold">{area.label}</p>
              <p className={`mt-1 text-sm ${active ? "text-bg/80" : "text-muted"}`}>{area.detail}</p>
            </>
          );
          if (area.id === "videos" || area.id === "vip") {
            return (
              <Link key={area.id} to={area.id === "videos" ? "/videos" : "/vip"} className={className}>
                {body}
              </Link>
            );
          }
          return (
            <button key={area.id} type="button" onClick={() => setSelected(area.id)} className={className}>
              {body}
            </button>
          );
        })}
      </div>
      {selected === "quiz" ? <QuizList /> : null}
    </Shell>
  );
}

function QuizList() {
  const [quizId, setQuizId] = useState(null);
  const quiz = QUIZZES.find((item) => item.id === quizId) ?? null;
  return (
    <div className="mt-6">
      {quiz ? (
        <Quiz quiz={quiz} onBack={() => setQuizId(null)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {QUIZZES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setQuizId(item.id)}
              className="rounded-xl border border-line bg-surface p-5 text-left"
            >
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-muted">{item.blurb}</p>
              <p className="mt-3 text-sm text-gold">{item.questions.length} 題</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Quiz({ quiz, onBack }) {
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <button type="button" className="text-sm text-gold" onClick={onBack}>
        返回測驗列表
      </button>
      <h2 className="mt-2 text-xl font-semibold">{quiz.title}</h2>
      <div className="mt-4 space-y-5">
        {quiz.questions.map((question, index) => (
          <fieldset key={question.prompt}>
            <legend className="font-medium">
              {index + 1}. {question.prompt}
            </legend>
            <div className="mt-2 space-y-2">
              {question.choices.map((choice, choiceIndex) => {
                const selected = answers[index] === choiceIndex;
                const revealed = score !== null;
                const correct = choiceIndex === question.answer;
                return (
                  <label
                    key={choice}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      revealed && correct ? "border-gold text-gold" : selected ? "border-gold bg-bg" : "border-line"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${index}`}
                      className="accent-gold"
                      checked={selected}
                      disabled={revealed}
                      onChange={() => setAnswers((current) => ({ ...current, [index]: choiceIndex }))}
                    />
                    {choice}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      {score === null ? (
        <button
          type="button"
          className="mt-5 rounded-lg bg-gold px-5 py-3 font-semibold text-bg disabled:opacity-50"
          disabled={Object.keys(answers).length < quiz.questions.length}
          onClick={() => {
            if (Object.keys(answers).length < quiz.questions.length) return;
            const next = quiz.questions.filter((question, index) => answers[index] === question.answer).length;
            setScore(next);
          }}
        >
          提交答案
        </button>
      ) : (
        <p className="mt-5 text-gold">
          得分 {score} / {quiz.questions.length}
        </p>
      )}
    </div>
  );
}
