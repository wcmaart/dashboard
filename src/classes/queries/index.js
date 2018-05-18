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
  hello[[]] {
    there
  }
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
    medium
    maker
    dimensions
    people
    creditline
  }
}`

    this.objectsLarge = `query {
  objects[[]] {
    id
    title
    medium
    maker
    dimensions
    people
    creditline
    raw {
        ...on EmuseumObject {
          primaryMaker {
            label
            value
          }
          primaryMedia {
            value
          }
          displayDate {
            label
            value
          }
          invno {
            label
            value
          }
          id {
            label
            value 
          }
          title {
            label
            value
          }
          classification {
            label
            value
          }
          creditline {
            label
            value
          }
          dimensions {
            label
            value
          }
          medium {
            label
            value
          }
          people {
            label
            values
          }
        }
      ...on CsvObject {
        accession_number
        maker
        ULAN
        department
        culture
        period
        creation_date
        creation_date_earliest
        creation_date_latest
        accesion_date
        source_name
        object_name
        credit_line
        paper_support
        catalogue_raisonne
        portfolio
        signed
        marks
        inscriptions
        filename
      }      
    }
  }
}`

    this.medias = `query {
  medias[[]] {
    name
  }
}`

    this.people = `query {
  people[[]] {
    name
  }
}`

    this.eventsMini = `query {
  events[[]] {
    eventId
  }
}`

    this.eventsMedium = `query {
  events[[]] {
    eventId
    eventName
    facultyMember
    subjectAndCourse
    subject
    courseNumber
    institution
    Description
    startDate
    histObjXIDs
  }
}`

    this.eventsLarge = `query {
  events[[]] {
    eventId
    eventName
    facultyMember
    subjectAndCourse
    subject
    courseNumber
    institution
    Description
    startDate
    histObjXIDs
    objects {
      id
      title
      medium
      maker
      dimensions
      people
      creditline
    }        
  }
}`

    this.places = `query {
  places[[]] {
    name
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
