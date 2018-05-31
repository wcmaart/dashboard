/** Class representing a collection of queries. */
class Queries {
  /**
   * Create a collection of queries
   */
  constructor () {
    this.schema = `query {
  __schema {
    types {
      description
      fields {
        args {
          name
          type {
            name
          }
          defaultValue
        }
        description
        name
        type {
          name
        }
      }
      kind
      name
    }
  }
}`
    this.type = `query {
  __type[[]] {
    name
    kind
    description
    fields {
      args {
        description
        defaultValue
      }
      description
      name
      type {        
        possibleTypes {
          name
          description
        }
        name
        description
      }
    }
  }
}`

    this.hello = `query {
  hello[[]]
}`

    this.objectsMini = `query {
  objects[[]] {
    id
  }
}`

    this.objectsMedium = `query {
  objects[[]] {
    id
    title
    maker
    period
    object_name
    medium
    remote {
      status
      original_image_id
      public_id
      version
      signature
      width
      height
      format
    }
  }
}`

    this.objectLarge = `query {
  object[[]] {
    id
    accession_number
    title
    maker
    ulan
    department    
    classification
    culture
    period
    creation_date
    creation_date_earliest
    creation_date_latest
    accession_date
    source_name
    object_name
    medium
    description
    credit_line
    paper_support
    catalogue_raisonne
    portfolio
    signed
    marks
    inscriptions
    filename
    dimensions
    element_type
    width_cm
    height_cm
    depth_cm
    width_in
    height_in
    depth_in
    area_in
    size_s_m_l
    is_3d
    orientation_p_l_s
    copyright_holder
    remote {
      status
      original_image_id
      public_id
      version
      signature
      width
      height
      format
    }
  }
}`

    this.objectNames = `query {
  objectNames[[]] {
    id
    title
    count
  }
}`

    this.makers = `query {
  makers[[]] {
    id
    title
    count
  }
}`

    this.periods = `query {
  periods[[]] {
    id
    title
    count
  }
}`

    this.mediums = `query {
  mediums[[]] {
    id
    title
    count
  }
}`
  }

  /**
   *
   * @param {string} query The name of the query, needs to match one of those defined in the constructor, i.e. 'schema', 'hello', places'
   * @param {string} filter The filter we want to apply to the query i.e. '(limit: 20)'
   * @returns {string|null} A representation of the query ready to be used if found, or null if not.
   */
  get (query, filter) {
    if (!(query in this)) return null
    return this[query].replace('[[]]', filter)
  }
}
/** A handy query class that contains a bunch of predefined GraphQL queries */
module.exports = Queries
