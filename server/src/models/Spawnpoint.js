const { Model, raw } = require('objection')
const dbSelection = require('../services/functions/dbSelection')
const getAreaSql = require('../services/functions/getAreaSql')
const { api: { queryLimits } } = require('../services/config')

module.exports = class Spawnpoint extends Model {
  static get tableName() {
    return dbSelection('spawnpoint').type === 'mad'
      ? 'trs_spawn' : 'spawnpoint'
  }

  static get idColumn() {
    return dbSelection('spawnpoint').type === 'mad'
      ? 'spawnpoint' : 'id'
  }

  static async getAllSpawnpoints(args, perms, isMad) {
    const { areaRestrictions } = perms
    const query = this.query()
    if (isMad) {
      query.select([
        'spawnpoint AS id',
        'latitude AS lat',
        'longitude AS lon',
        raw('ROUND(calc_endminsec)')
          .as('despawn_sec'),
        raw('UNIX_TIMESTAMP(last_scanned)')
          .as('updated'),
      ])
    }
    query.whereBetween(`lat${isMad ? 'itude' : ''}`, [args.minLat, args.maxLat])
      .andWhereBetween(`lon${isMad ? 'gitude' : ''}`, [args.minLon, args.maxLon])
    if (areaRestrictions?.length) {
      getAreaSql(query, areaRestrictions, isMad)
    }
    return query.limit(queryLimits.spawnpoints)
  }
}
