import { gql } from '@apollo/client'

const getAllDevices = gql`
  query Devices {
    devices{
      uuid
      instance_name
      last_seen
      last_lat
      last_lon
      route
      type
      isMad
    }
  }
`

export default getAllDevices
