module Menu exposing (Config, State, view)

import Element
import Element.Background as Background
import Element.Border as Border
import Element.Events as Events



-- MODEL


type alias Config msg =
    { label : String
    , items : List String
    , activate : Bool -> msg
    , activateItem : Maybe ( Int, String ) -> msg
    , selectCurrentItem : msg
    }


type alias State =
    { visible : Bool
    , active : Maybe Int
    }



-- VIEW


view : Config msg -> State -> Element.Element msg
view config state =
    let
        maybeMenu =
            if state.visible then
                Element.column
                    [ Element.alignRight
                    , Element.moveRight 1
                    , Element.paddingXY 0 4
                    , Background.color <| Element.rgb255 255 255 255
                    , Border.color <| Element.rgb255 170 170 170
                    , Border.width 1
                    , Border.shadow
                        { offset = ( 0.0, 8.0 )
                        , size = 0.0
                        , blur = 16.0
                        , color = Element.rgba 0.0 0.0 0.0 0.2
                        }
                    ]
                    (List.indexedMap (viewItem config state) config.items)

            else
                Element.none
    in
    Element.el
        [ Element.below maybeMenu
        , Events.onMouseEnter <| config.activate True
        , Events.onMouseLeave <| config.activate False
        , Element.paddingXY 16 8
        , Element.pointer
        , Background.color <| Element.rgb255 255 255 255
        , Border.color <| Element.rgb255 170 170 170
        , Border.width 1
        ]
        (Element.text config.label)


viewItem : Config msg -> State -> Int -> String -> Element.Element msg
viewItem config state index label =
    if label == "--" then
        Element.el
            [ Element.width Element.fill
            , Element.paddingXY 0 4
            ]
            (Element.el
                [ Element.width Element.fill
                , Border.color <| Element.rgb255 170 170 170
                , Border.widthEach { bottom = 1, top = 0, left = 0, right = 0 }
                ]
                Element.none
            )

    else
        Element.el
            [ Element.width Element.fill
            , Events.onMouseEnter <| config.activateItem (Just ( index, label ))
            , Events.onMouseLeave <| config.activateItem Nothing
            , Events.onClick config.selectCurrentItem
            , Element.paddingXY 16 4
            , Background.color
                (if state.active == Just index then
                    Element.rgb255 170 170 170

                 else
                    Element.rgb255 255 255 255
                )
            ]
            (Element.text label)
