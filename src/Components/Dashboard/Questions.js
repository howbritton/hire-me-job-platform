import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, push, get, update, remove } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { FaEdit, FaTrash, FaPlus } from 'react-icons/fa';

const Questions = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    type: 'multiple_choice', // Changed default to multiple_choice since text is removed
    required: true,
    options: [''],
    category: 'general'
  });
  const [isEditing, setIsEditing] = useState(false);

  const auth = getAuth(app);
  const db = getDatabase(app);

  const fetchQuestions = useCallback(async () => {
    try {
      const questionsRef = ref(db, `employers/${auth.currentUser.uid}/questions`);
      const snapshot = await get(questionsRef);
      
      if (snapshot.exists()) {
        const questionsData = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data
        }));
        setQuestions(questionsData);
      } else {
        setQuestions([]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Error loading questions');
      setLoading(false);
    }
  }, [db, auth.currentUser.uid]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setCurrentQuestion(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (name === 'type' && value !== 'multiple_choice') {
      // Reset options if changing from multiple choice to another type
      setCurrentQuestion(prev => ({
        ...prev,
        [name]: value,
        options: ['']
      }));
    } else {
      setCurrentQuestion(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleOptionChange = (index, value) => {
    setCurrentQuestion(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const addOption = () => {
    setCurrentQuestion(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const removeOption = (index) => {
    if (currentQuestion.options.length > 1) {
      setCurrentQuestion(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }));
    }
  };

  const resetForm = () => {
    setCurrentQuestion({
      question: '',
      type: 'multiple_choice', // Changed default to multiple_choice
      required: true,
      options: [''],
      category: 'general'
    });
    setIsEditing(false);
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const questionData = {
        ...currentQuestion,
        createdAt: new Date().toISOString()
      };

      // Only include options for multiple_choice type
      if (questionData.type === 'multiple_choice') {
        questionData.options = currentQuestion.options.filter(opt => opt.trim() !== '');
        if (questionData.options.length < 2) {
          toast.error('Multiple choice questions must have at least two options');
          return;
        }
      } else {
        // Remove options field for other question types
        delete questionData.options;
      }

      if (isEditing && currentQuestion.id) {
        // Remove id from the data to be updated
        const { id, ...updateData } = questionData;
        await update(ref(db, `employers/${auth.currentUser.uid}/questions/${currentQuestion.id}`), updateData);
        toast.success('Question updated successfully');
      } else {
        await push(ref(db, `employers/${auth.currentUser.uid}/questions`), questionData);
        toast.success('Question created successfully');
      }

      resetForm();
      fetchQuestions();
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Error saving question');
    }
  };

  const handleEdit = (question) => {
    const editQuestion = {
      ...question,
      options: question.type === 'multiple_choice' ? (question.options || ['']) : ['']
    };
    setCurrentQuestion(editQuestion);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (questionId) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await remove(ref(db, `employers/${auth.currentUser.uid}/questions/${questionId}`));
        toast.success('Question deleted successfully');
        fetchQuestions();
      } catch (error) {
        console.error('Error deleting question:', error);
        toast.error('Error deleting question');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-950">Pre-Screening Questions</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-blue-950 text-white rounded-md hover:bg-[#cddd3a] hover:text-blue-950"
        >
          <FaPlus className="mr-2" /> Add Question
        </button>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((question) => (
          <div key={question.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{question.question}</h3>
                <div className="mt-2 space-x-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {question.type}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {question.category}
                  </span>
                  {question.required && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Required
                    </span>
                  )}
                </div>
                {question.type === 'multiple_choice' && question.options && question.options.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">Options:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600 ml-4">
                      {question.options.map((option, index) => (
                        <li key={index}>{option}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(question)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <FaEdit className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDelete(question.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <FaTrash className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {questions.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No questions added yet</p>
          </div>
        )}
      </div>

      {/* Question Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <div className="relative bg-white rounded-lg w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {isEditing ? 'Edit Question' : 'Add New Question'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Question*
                  </label>
                  <input
                    type="text"
                    name="question"
                    required
                    value={currentQuestion.question}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Question Type*
                  </label>
                  <select
                    name="type"
                    required
                    value={currentQuestion.type}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="yes_no">Yes/No</option>
                  </select>
                </div>

                {currentQuestion.type === 'multiple_choice' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Options
                    </label>
                    {currentQuestion.options.map((option, index) => (
                      <div key={index} className="flex mb-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          placeholder={`Option ${index + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="ml-2 text-red-600 hover:text-red-800"
                          disabled={currentQuestion.options.length <= 1}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addOption}
                      className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      + Add Option
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <select
                    name="category"
                    value={currentQuestion.category}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="general">General</option>
                    <option value="experience">Experience</option>
                    <option value="education">Education</option>
                    <option value="skills">Skills</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="required"
                    checked={currentQuestion.required}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Required question
                  </label>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-950 rounded-md hover:bg-[#cddd3a] hover:text-blue-950"
                  >
                    {isEditing ? 'Update Question' : 'Add Question'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Questions;