exports.index = (req, res) => {
  req.templateValues.msg = 'hello world'
  return res.render('main/index', req.templateValues)
}
