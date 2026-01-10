export const validationRules = {
    aboutMe: {
      maxLength: 2000,
      minLength: 50
    },
    skills: {
      maxSkills: 20,
      minLength: 2,
      maxLength: 50
    },
    workExperience: {
      maxPositions: 10,
      descriptionMaxLength: 1000,
      companyMaxLength: 100,
      positionMaxLength: 100
    },
    education: {
      maxEntries: 5,
      institutionMaxLength: 100,
      degreeMaxLength: 100,
      fieldMaxLength: 100
    }
  };