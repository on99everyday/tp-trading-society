import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QUIZZES } from "../course";
import { Pending, Shell, useAuthedProfile } from "../components/Shell";

export function QuizPage() {
  const { profile, pending } = useAuthedProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!pending && !profile) navigate("/login");
  }, [pending, profile, navigate]);

  if (pending || !profile) return <Pending />;
  return <QuizArea profile={profile} />;
}

function QuizArea({ profile }) {
  const { quizId } = useParams();
  const quiz = QUIZZES.find((item) => item.id === quizId) ?? null;

  return (
    <Shell profile={profile}>
      <p className="text-sm text-gold">學園測驗區</p>
      <h1 className="mt-1 text-3xl font-semibold">{quiz ? quiz.title : "學園測驗"}</h1>
      <p className="mt-2 max-w-xl text-muted">{quiz ? quiz.blurb : "用小測檢查是否真的學會"}</p>
      <Link to={quizId ? "/quiz" : "/"} className="mt-3 inline-block text-sm font-medium text-gold">
        {quizId ? "返回測驗列表" : "返回課程首頁"}
      </Link>
      {quizId && !quiz ? <p className="mt-6 text-muted">找不到這個測驗。</p> : null}
      {!quizId ? <QuizList /> : null}
      {quiz ? <Quiz quiz={quiz} /> : null}
    </Shell>
  );
}

function QuizList() {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {QUIZZES.map((item) => (
        <Link
          key={item.id}
          to={`/quiz/${item.id}`}
          className="rounded-xl border border-line bg-surface p-5 text-left"
        >
          <h2 className="text-lg font-semibold">{item.title}</h2>
          <p className="mt-1 text-sm text-muted">{item.blurb}</p>
          <p className="mt-3 text-sm text-gold">{item.questions.length} 題</p>
        </Link>
      ))}
    </div>
  );
}

function Quiz({ quiz }) {
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  return (
    <div className="mt-6 rounded-xl border border-line bg-surface p-5">
      <div className="space-y-5">
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
