exports.index = (request, response) => {
  const templateValues = {}
  templateValues.msg = 'This worked'
  return response.render('main/index', templateValues)
}
