import { validationRules } from './validationRules';

export const validateAboutMe = (text) => {
  if (!text || text.trim().length < validationRules.aboutMe.minLength) {
    return `About Me section must be at least ${validationRules.aboutMe.minLength} characters`;
  }
  if (text.length > validationRules.aboutMe.maxLength) {
    return `About Me section cannot exceed ${validationRules.aboutMe.maxLength} characters`;
  }
  return null;
};

export const validateSkill = (skill, existingSkills) => {
  if (!skill || skill.trim().length < validationRules.skills.minLength) {
    return `Skill must be at least ${validationRules.skills.minLength} characters`;
  }
  if (skill.length > validationRules.skills.maxLength) {
    return `Skill cannot exceed ${validationRules.skills.maxLength} characters`;
  }
  if (existingSkills.includes(skill.trim())) {
    return 'This skill has already been added';
  }
  if (existingSkills.length >= validationRules.skills.maxSkills) {
    return `Maximum ${validationRules.skills.maxSkills} skills allowed`;
  }
  return null;
};

export const validateWorkExperience = (experience) => {
  const errors = {};

  if (!experience.company?.trim()) {
    errors.company = 'Company name is required';
  } else if (experience.company.length > validationRules.workExperience.companyMaxLength) {
    errors.company = `Company name cannot exceed ${validationRules.workExperience.companyMaxLength} characters`;
  }

  if (!experience.position?.trim()) {
    errors.position = 'Position is required';
  } else if (experience.position.length > validationRules.workExperience.positionMaxLength) {
    errors.position = `Position cannot exceed ${validationRules.workExperience.positionMaxLength} characters`;
  }

  if (!experience.startDate) {
    errors.startDate = 'Start date is required';
  }

  if (!experience.current && !experience.endDate) {
    errors.endDate = 'End date is required if not current position';
  }

  if (experience.startDate && experience.endDate && !experience.current) {
    if (new Date(experience.startDate) > new Date(experience.endDate)) {
      errors.endDate = 'End date cannot be before start date';
    }
  }

  if (experience.description?.length > validationRules.workExperience.descriptionMaxLength) {
    errors.description = `Description cannot exceed ${validationRules.workExperience.descriptionMaxLength} characters`;
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

export const validateEducation = (education) => {
  const errors = {};

  if (!education.institution?.trim()) {
    errors.institution = 'Institution name is required';
  } else if (education.institution.length > validationRules.education.institutionMaxLength) {
    errors.institution = `Institution name cannot exceed ${validationRules.education.institutionMaxLength} characters`;
  }

  if (!education.degree?.trim()) {
    errors.degree = 'Degree is required';
  } else if (education.degree.length > validationRules.education.degreeMaxLength) {
    errors.degree = `Degree cannot exceed ${validationRules.education.degreeMaxLength} characters`;
  }

  if (!education.field?.trim()) {
    errors.field = 'Field of study is required';
  } else if (education.field.length > validationRules.education.fieldMaxLength) {
    errors.field = `Field cannot exceed ${validationRules.education.fieldMaxLength} characters`;
  }

  if (!education.startDate) {
    errors.startDate = 'Start date is required';
  }

  if (!education.current && !education.endDate) {
    errors.endDate = 'End date is required if not currently studying';
  }

  if (education.startDate && education.endDate && !education.current) {
    if (new Date(education.startDate) > new Date(education.endDate)) {
      errors.endDate = 'End date cannot be before start date';
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
};