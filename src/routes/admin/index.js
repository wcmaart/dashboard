exports.index = (req, res) => {
  return res.render('admin/index', req.templateValues)
}

exports.users = (req, res) => {
  return res.render('admin/users', req.templateValues)
}
