import { ArmchairIcon, BedIcon, DropletIcon, PlugIcon, SnowflakeIcon, SparklesIcon, UtensilsIcon, WifiIcon } from './Icons'

export function FacilityIcon({ name, size = 16 }) {
  switch (name) {
    case 'AC':
      return <SnowflakeIcon size={size} />
    case 'WiFi':
      return <WifiIcon size={size} />
    case 'USB Charger':
      return <PlugIcon size={size} />
    case 'Reclining Seat':
    case 'Recliner 140°':
      return <ArmchairIcon size={size} />
    case 'Snack':
      return <UtensilsIcon size={size} />
    case 'Toilet':
      return <DropletIcon size={size} />
    case 'Kasur Recliner':
      return <BedIcon size={size} />
    case 'Selimut':
      return <BedIcon size={size} />
    case 'Bantal':
      return <BedIcon size={size} />
    case 'Makan Malam':
      return <UtensilsIcon size={size} />
    case 'Hiburan':
      return <SparklesIcon size={size} />
    default:
      return <SparklesIcon size={size} />
  }
}

export function FacilityList({ facilities = [], limit = 4, showLabel = false }) {
  const list = facilities.slice(0, limit)
  return (
    <div className={`row row-gap-2${showLabel ? ' align-items-center' : ''}`}>
      {list.length ? (
        list.map((facility) => (
          <span key={facility} className="facility">
            {showLabel ? <span className="facility__label">{facility}</span> : null}
            <FacilityIcon name={facility} size={showLabel ? 13 : 14} />
          </span>
        ))
      ) : (
        <span className="tiny subtle">Belum ada fasilitas yang dicatat.</span>
      )}
    </div>
  )
}
