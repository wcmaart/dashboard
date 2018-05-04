const decortation = require('../../modules/decoration')

exports.index = (req, res) => {
  if (req.user === null) {
    const design = decortation.pickLoggedOutDesign()
    req.templateValues.design = design
    return res.render('main/pleaselogin', req.templateValues)
  }

  return res.redirect('/developer')
}

exports.wait = (req, res) => {
  const design = decortation.pickLoggedOutDesign()
  req.templateValues.design = design
  return res.render('config/wait', req.templateValues)
}
