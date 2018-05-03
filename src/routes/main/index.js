exports.index = (req, res) => {
  req.templateValues.msg = 'hello world'
  return res.render('main/index', req.templateValues)
}

exports.wait = (req, res) => {
  req.templateValues.msg = 'hello world'
  return res.render('config/wait', req.templateValues)
}
