export const submissionStatusLabel = (status) => ({
  SUBMITTED: 'Đã nộp',
  EVALUATING: 'Đang đánh giá',
  EVALUATED: 'Đã có kết quả AI',
  AI_FAILED: 'AI chưa đánh giá được',
  TEACHER_REVIEWED: 'Giảng viên đã duyệt',
}[status] || 'Chưa nộp');

export const buildQuizAnswers = (selectedByQuestion) => Object.entries(selectedByQuestion)
  .sort(([left], [right]) => Number(left) - Number(right))
  .map(([questionIndex, selectedOptions]) => ({
    questionIndex: Number(questionIndex),
    selectedOptions: [...selectedOptions].map(Number).sort((left, right) => left - right),
  }));

export const toSubmissionForm = ({ answers, notes, files }) => {
  const body = new FormData();
  if (answers) body.append('answersJson', JSON.stringify(answers));
  if (notes?.trim()) body.append('notes', notes.trim());
  for (const file of files || []) body.append('files', file);
  return body;
};
