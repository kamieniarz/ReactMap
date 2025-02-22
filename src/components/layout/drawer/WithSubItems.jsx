import React from 'react'
import {
  Grid, Typography, Switch,
} from '@material-ui/core'
import { useTranslation } from 'react-i18next'

import Utility from '@services/Utility'
import MultiSelector from './MultiSelector'
import SliderTile from '../dialogs/filters/SliderTile'

export default function WithSubItems({
  category, filters, setFilters, subItem, noScanAreaOverlay, enableQuestSetSelector, data,
}) {
  const { t } = useTranslation()

  if (category === 'scanAreas' && noScanAreaOverlay) {
    return null
  }

  const filterCategory = category === 'wayfarer' || category === 'admin'
    ? (
      <Switch
        checked={filters[subItem].enabled}
        onChange={() => {
          setFilters({
            ...filters,
            [subItem]: {
              ...filters[subItem],
              enabled: !filters[subItem].enabled,
            },
          })
        }}
      />
    )
    : (
      <Switch
        checked={filters[category][subItem]}
        onChange={() => {
          setFilters({
            ...filters,
            [category]: {
              ...filters[category],
              [subItem]: !filters[category][subItem],
            },
          })
        }}
      />
    )

  if (category === 'nests' && subItem === 'sliders') {
    return (
      <Grid item xs={12} style={{ textAlign: 'center' }}>
        <SliderTile
          filterSlide={data.secondary[0]}
          handleChange={(_, values) => setFilters({
            ...filters,
            [category]: {
              ...filters[category],
              avgFilter: values,
            },
          })}
          filterValues={filters[category]}
        />
      </Grid>
    )
  }

  return (
    <>
      <Grid item xs={6}>
        <Typography>{category === 'scanAreas' ? t('show_polygons') : t(Utility.camelToSnake(subItem))}</Typography>
      </Grid>
      <Grid item xs={6} style={{ textAlign: 'right' }}>
        {filterCategory}
      </Grid>
      {enableQuestSetSelector === true && category === 'pokestops' && subItem === 'quests' && filters[category].quests === true && (
        <Grid item xs={12} style={{ textAlign: 'center' }}>
          <MultiSelector
            filters={filters}
            setFilters={setFilters}
            category={category}
            filterKey="showQuestSet"
            items={['with_ar', 'both', 'without_ar']}
          />
        </Grid>
      )}
      {category === 'gyms' && subItem === 'gymBadges' && filters[category].gymBadges === true && (
        <Grid item xs={12} style={{ textAlign: 'center' }}>
          <MultiSelector
            filters={filters}
            setFilters={setFilters}
            category={category}
            filterKey="badge"
            items={['all', 'badge_1', 'badge_2', 'badge_3']}
          />
        </Grid>
      )}
    </>
  )
}
