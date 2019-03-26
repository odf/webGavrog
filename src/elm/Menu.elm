module Menu exposing (Config, Entry(..), Item, Result, State, init, view)

import Element
import Element.Background as Background
import Element.Border as Border
import Element.Events as Events
import Element.Font as Font


type alias Item a =
    { label : String
    , hotKey : Maybe String
    , action : a
    }


type State a
    = Internals (Maybe (Item a))


type Entry a
    = Separator
    | Header String
    | Choice (Item a)


type alias Config a =
    List (Entry a)


type alias Result a =
    Maybe a


init : State a
init =
    Internals Nothing


gray : Element.Color
gray =
    Element.rgb255 170 170 170


white : Element.Color
white =
    Element.rgb255 255 255 255


view :
    (State a -> Result a -> msg)
    -> Config a
    -> State a
    -> Element.Element msg
view toMsg entries state =
    Element.column
        [ Element.alignLeft
        , Element.paddingXY 0 4
        , Background.color white
        , Border.color gray
        , Border.width 1
        , Border.shadow
            { offset = ( 0.0, 8.0 )
            , size = 0.0
            , blur = 16.0
            , color = Element.rgba 0.0 0.0 0.0 0.2
            }
        ]
        (List.map (viewItem toMsg state) entries)


viewItem :
    (State a -> Result a -> msg)
    -> State a
    -> Entry a
    -> Element.Element msg
viewItem toMsg (Internals active) entry =
    case entry of
        Separator ->
            viewSeparator

        Header title ->
            viewHeader title

        Choice item ->
            viewChoice toMsg (active == Just item) item


viewSeparator : Element.Element msg
viewSeparator =
    Element.el
        [ Element.width Element.fill
        , Element.paddingXY 0 4
        ]
        (Element.el
            [ Element.width Element.fill
            , Element.height <| Element.px 1
            , Background.color gray
            ]
            Element.none
        )


viewHeader : String -> Element.Element msg
viewHeader title =
    Element.el
        [ Element.width Element.fill
        , Element.paddingXY 16 8
        , Font.bold
        ]
        (Element.el [ Element.centerX ]
            (Element.text title)
        )


viewChoice :
    (State a -> Result a -> msg)
    -> Bool
    -> Item a
    -> Element.Element msg
viewChoice toMsg isActive item =
    let
        color =
            if isActive then
                Element.rgb255 238 238 238

            else
                white

        extra =
            item.hotKey |> Maybe.withDefault ""
    in
    Element.row
        [ Element.width Element.fill
        , Events.onMouseEnter <| toMsg (Internals <| Just item) Nothing
        , Events.onMouseLeave <| toMsg (Internals Nothing) Nothing
        , Events.onClick <| toMsg (Internals <| Just item) (Just item.action)
        , Element.paddingXY 16 4
        , Background.color color
        ]
        [ Element.text item.label
        , Element.text "        "
        , Element.el [ Element.alignRight, Font.color gray ]
            (Element.text extra)
        ]
