import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuizAnswers, submissionStatusLabel, toSubmissionForm } from '../src/utils/assignmentWorkflow.js';

test('buildQuizAnswers returns ordered numeric answers for the submission API', () => {
  assert.deepEqual(buildQuizAnswers({ 2: [1, 0], 0: [2] }), [
    { questionIndex: 0, selectedOptions: [2] },
    { questionIndex: 2, selectedOptions: [0, 1] },
  ]);
});

test('submission status labels cover evaluation and teacher review states', () => {
  assert.equal(submissionStatusLabel('AI_FAILED'), 'AI chưa đánh giá được');
  assert.equal(submissionStatusLabel('TEACHER_REVIEWED'), 'Giảng viên đã duyệt');
});

test('toSubmissionForm uses the multipart names expected by the backend', () => {
  const body = toSubmissionForm({ answers: [[1]], notes: ' Ghi chú ', files: [] });
  assert.equal(body.get('answersJson'), '[[1]]');
  assert.equal(body.get('notes'), 'Ghi chú');
});
